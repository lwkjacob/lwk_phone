-- The apps that lean on the framework (Wallet, Garage, Services, Home, Crypto), plus uploads and AirShare.

--- Players with a phone standing within Config.airShareRange of `src`: { { id, name } }.
local function near(src)
    local out, here = {}, GetEntityCoords(GetPlayerPed(src))
    for other in pairs(Phone.online()) do
        if other ~= src and #(GetEntityCoords(GetPlayerPed(other)) - here) <= Config.airShareRange then
            out[#out + 1] = { id = other, name = Bridge.name(other) }
        end
    end
    return out
end

local function isNear(src, target)
    for _, p in ipairs(near(src)) do
        if p.id == target then return true end
    end
    return false
end

-- Wallet -----------------------------------------------------------------------------------------

Wallet = {}

--- A line in the phone's Wallet history. With `src` (the player whose money moved) it is also
--- added to the bank script's own history, where that bank needs telling.
local function record(number, label, amount, src)
    if src then Bank.statement(src, amount, label) end
    local txs = Phone.get(number, 'txs') or {}
    table.insert(txs, 1, { id = Phone.now() + math.random(0, 999), label = label, amount = amount, time = Phone.now() })
    while #txs > 40 do table.remove(txs) end
    Phone.set(number, 'txs', txs)
end
Wallet.record = record

function Wallet.slice(src, number)
    return { balance = Bridge.getBank(src), cash = Bridge.getCash(src), iban = number, txs = Phone.get(number, 'txs') or {} }
end

local function phoneName(number)
    return MySQL.scalar.await('SELECT name FROM lwk_phone_phones WHERE number = ?', { number }) or number
end

--- Move bank money from the player holding `number` to whoever holds (or last held) phone `to`.
--- Returns true, or false plus a message for the UI.
function Wallet.transfer(src, number, to, amount)
    amount = Util.int(amount, 1, 100000000)
    to = Util.number(to)
    if not Bridge.has.money or not amount or not to or to == number then return false, L('err_generic') end
    local target = Phone.source(to)   -- whoever has that phone up right now
    local owner = not target and MySQL.scalar.await('SELECT owner FROM lwk_phone_last WHERE number = ? LIMIT 1', { to })
    if not target and not owner then return false, L('err_number') end
    -- The phone's last user can be online without it up (another phone in hand, or still loading).
    -- They are paid directly: money written into their saved row would be overwritten, and lost, the
    -- next time the framework saves them.
    local payee = target or Bridge.sourceOf(owner)
    if not Bridge.removeBank(src, amount, 'phone-transfer') then return false, L('err_funds') end

    local paid
    if payee then paid = Bridge.addBank(payee, amount, 'phone-transfer') else paid = Bridge.addBankOffline(owner, amount) end
    if not paid then
        Bridge.addBank(src, amount, 'phone-transfer-refund')
        return false, L('err_generic')
    end
    record(number, phoneName(to), -amount, src)
    record(to, phoneName(number), amount, payee)
    Phone.patch(src, { wallet = Wallet.slice(src, number) })
    if target then
        Phone.patch(target, { wallet = Wallet.slice(target, to) })
        Phone.notify(target, 'wallet', L('wallet_title'), L('wallet_received', amount, phoneName(number)))
    end
    Phone.log(('**transfer** %s -> %s: $%d'):format(number, to, amount))
    return true
end

Apps.wallet = function(src, number)
    return { wallet = Wallet.slice(src, number) }
end

RPC['wallet.send'] = function(src, number, data)
    local ok, err = Wallet.transfer(src, number, data.to, data.amount)
    if not ok then return Phone.fail(err) end
    return Phone.ok()
end

RPC['wallet.request'] = function(_, number, data)
    local to, amount = Util.number(data.to), Util.int(data.amount, 1, 100000000)
    if not to or not amount then return Phone.fail(L('err_generic')) end
    Phone.notify(to, 'wallet', L('wallet_title'), L('wallet_requested', phoneName(number), amount))
    return Phone.ok()
end

-- Garage -----------------------------------------------------------------------------------------

local function plateOf(text) return (tostring(text or ''):gsub('^%s+', ''):gsub('%s+$', '')) end

local function vehicles(src)
    local out = {}
    for i, v in ipairs(Bridge.vehicles(src)) do
        out[i] = { id = i, plate = plateOf(v.plate), model = v.model, name = tostring(v.model), state = v.state,
            garage = v.garage, fuel = v.fuel, engine = v.engine, body = v.body, color = '#8e8e93' }
    end
    return out
end

Apps.garage = function(src)
    return { vehicles = vehicles(src) }
end

--- Bring a garaged or impounded vehicle to the player, for a fee. The client spawns it.
RPC['garage.valet'] = function(src, number, data)
    local plate, found = plateOf(data.plate), nil
    for _, v in ipairs(Bridge.vehicles(src)) do
        if plateOf(v.plate) == plate then found = v end
    end
    if not found or found.state == 'out' then return Phone.fail(L('err_generic')) end
    if found.state == 'impound' and (found.held or not Config.garage.fromImpound) then return Phone.fail(L('err_impound')) end
    local fee = found.state == 'impound' and Config.garage.impoundFee or Config.garage.valetFee
    if not Bridge.removeBank(src, fee, 'phone-valet') then return Phone.fail(L('err_funds')) end
    if not Bridge.vehicleOut(src, found.plate) then
        Bridge.addBank(src, fee, 'phone-valet-refund')
        return Phone.fail(L('err_generic'))
    end
    record(number, found.state == 'impound' and L('tx_impound') or L('tx_valet'), -fee, src)
    return Phone.ok({ spawn = { model = found.model, plate = found.plate, props = found.props }, vehicles = vehicles(src) })
end

--- Where one of the player's own vehicles is right now, for a waypoint.
RPC['garage.locate'] = function(src, _, data)
    local plate, mine = plateOf(data.plate), false
    for _, v in ipairs(Bridge.vehicles(src)) do
        if plateOf(v.plate) == plate then mine = true end
    end
    -- Anyone else's plate would turn the phone into a tracker for every car on the server.
    if not mine then return Phone.fail(L('err_vehicle_not_found')) end
    for _, veh in ipairs(GetAllVehicles()) do
        if plateOf(GetVehicleNumberPlateText(veh)) == plate then
            local pos = GetEntityCoords(veh)
            return Phone.ok({ x = pos.x, y = pos.y })
        end
    end
    return Phone.fail(L('err_vehicle_not_found'))
end

-- Services ---------------------------------------------------------------------------------------

local function jobSlice(src)
    local j = Bridge.getJob(src)
    if not j or j.name == Bridge.unemployed then return false end
    local staff = {}
    if j.isBoss then
        for i, e in ipairs(Bridge.employees(j.name)) do
            staff[i] = { id = e.id, name = e.name, grade = e.gradeLabel or tostring(e.grade), online = Bridge.sourceOf(e.id) ~= nil }
        end
    end
    return { company = j.name, label = j.label, grade = j.gradeLabel or tostring(j.grade), duty = j.duty, boss = j.isBoss, staff = staff,
        balance = j.isBoss and Bank.balance(j.name) or nil }
end

Apps.services = function(src)
    local list = {}
    for i, c in ipairs(Config.companies) do
        local n = #Bridge.onDuty(c.job)
        list[i] = { id = c.job, icon = c.icon, name = c.name, desc = c.desc, color = c.color, online = n, open = n > 0, number = c.job }
    end
    return { services = list, job = jobSlice(src) }
end

--- A text to a company goes to every employee on duty, as an ordinary conversation with each.
RPC['company.text'] = function(src, number, data)
    local text, sent = Util.text(data.text, 1, 500), 0
    if not text then return Phone.fail(L('err_generic')) end
    for _, c in ipairs(Config.companies) do
        if c.job == data.job then
            for _, employee in ipairs(Bridge.onDuty(c.job)) do
                local n = Phone.number(employee)
                if n and n ~= number and Messages.text(src, number, { n }, nil, { text = text }) then sent = sent + 1 end
            end
        end
    end
    if sent == 0 then return Phone.fail(L('err_nobody_on_duty')) end
    return Phone.ok({ chats = Messages.chats(number) })
end

RPC['job.duty'] = function(src)
    Bridge.toggleDuty(src)
    return Phone.ok({ job = jobSlice(src) })
end

local moving = {}   -- job -> true while its company account is being changed

--- A boss moves money between their own bank account and the company's (config/bridge/banking.lua).
RPC['job.bank'] = function(src, number, data)
    local j, amount = Bridge.getJob(src), Util.int(data.amount, 1, 100000000)
    if not j or not j.isBoss or not amount or moving[j.name] or Bank.balance(j.name) == nil then return Phone.fail(L('err_generic')) end
    moving[j.name] = true
    local who = Bridge.name(src)
    -- In a pcall so that an error in a bank script cannot leave the account locked until a restart.
    local ran, done, err = pcall(function()
        if data.deposit then
            if not Bridge.removeBank(src, amount, 'phone-company') then return false, L('err_funds') end
            if Bank.add(j.name, amount, who) then return true end
            Bridge.addBank(src, amount, 'phone-company-refund')
            return false
        end
        if not Bank.remove(j.name, amount, who) then return false, L('err_funds') end
        if Bridge.addBank(src, amount, 'phone-company') then return true end
        Bank.add(j.name, amount, who)
        return false
    end)
    moving[j.name] = nil
    if not ran then error(done) end
    if not done then return Phone.fail(err or L('err_generic')) end
    record(number, L(data.deposit and 'tx_company_in' or 'tx_company_out'):format(j.label or j.name), data.deposit and -amount or amount, src)
    Phone.log(('**company** %s %s $%d (%s)'):format(j.name, data.deposit and 'deposit' or 'withdrawal', amount, who))
    return Phone.ok({ job = jobSlice(src), wallet = Wallet.slice(src, number) })
end

RPC['job.hire'] = function(src, _, data)
    local j, target = Bridge.getJob(src), Util.int(data.id, 1, 65535)
    -- Only someone standing next to the boss: a job is not something to hand to a stranger across the map
    -- (hiring replaces the job they had).
    if not j or not j.isBoss or not target or not isNear(src, target) then return Phone.fail(L('err_generic')) end
    if not Bridge.setJob(target, j.name, 0) then return Phone.fail(L('err_generic')) end
    return Phone.ok({ job = jobSlice(src) })
end

RPC['job.fire'] = function(src, _, data)
    local j = Bridge.getJob(src)
    if not j or not j.isBoss or type(data.id) ~= 'string' or data.id == Bridge.identifier(src) then return Phone.fail(L('err_generic')) end
    for _, e in ipairs(Bridge.employees(j.name)) do
        if e.id == data.id then
            -- A boss answers for the grades below their own, not for other bosses.
            if (tonumber(e.grade) or 0) >= (tonumber(j.grade) or 0) then return Phone.fail(L('err_generic')) end
            local target = Bridge.sourceOf(e.id)
            if not target then return Phone.fail(L('err_offline')) end
            Bridge.setJob(target, Bridge.unemployed, 0)
            return Phone.ok({ job = jobSlice(src) })
        end
    end
    return Phone.fail(L('err_generic'))
end

-- Home (delegates to config/bridge/housing.lua) -------------------------------------------------------

Apps.home = function(src)
    return { houses = Housing.enabled and Housing.list(src) or {} }
end

RPC['home.lock'] = function(src, _, data)
    local locked = Housing.enabled and Housing.setLocked(src, data.id, data.locked == true)
    if locked == nil or locked == false and data.locked == true then return Phone.fail(L('err_generic')) end
    return Phone.ok({ houses = Housing.list(src) })
end

RPC['home.key'] = function(src, _, data)
    local who = Util.number(data.number)
    local done = Housing.enabled and who and (data.give and Housing.addKey(src, data.id, who) or not data.give and Housing.removeKey(src, data.id, who))
    if not done then return Phone.fail(L('err_generic')) end
    return Phone.ok({ houses = Housing.list(src) })
end

-- Crypto -----------------------------------------------------------------------------------------
-- Prices drift on a timer and are the same for everyone. Holdings are stored per phone and only
-- ever change here, on the server.

local coins = {}

CreateThread(function()
    DB.wait()
    local saved = Phone.get('_market', 'coins') or {}
    for i, c in ipairs(Config.crypto.coins) do
        local price = tonumber(saved[c.id]) or c.price
        coins[i] = { id = c.id, name = c.name, color = c.color, price = price, open = price, hist = {} }
        for n = 1, 32 do coins[i].hist[n] = price end
    end
    while Config.crypto.enabled and Bridge.has.money do
        Wait(Config.crypto.tickSeconds * 1000)
        local prices = {}
        for _, c in ipairs(coins) do
            c.price = math.max(0.0001, c.price * (1 + (math.random() - 0.49) * 0.02))
            table.remove(c.hist, 1)
            c.hist[#c.hist + 1] = c.price
            prices[c.id] = c.price
        end
        Phone.set('_market', 'coins', prices)
    end
end)

local function coinSlice(number)
    local owned, out = Phone.get(number, 'crypto') or {}, {}
    for i, c in ipairs(coins) do
        out[i] = { id = c.id, name = c.name, color = c.color, price = c.price, hist = c.hist,
            change = (c.price / c.open - 1) * 100, owned = tonumber(owned[c.id]) or 0 }
    end
    return out
end

Apps.crypto = function(src, number)
    return { coins = coinSlice(number), wallet = Wallet.slice(src, number) }
end

RPC['crypto.trade'] = function(src, number, data)
    local usd, coin = Util.int(math.floor(tonumber(data.usd) or 0), 1, 100000000), nil
    for _, c in ipairs(coins) do
        if c.id == data.id then coin = c end
    end
    if not usd or not coin then return Phone.fail(L('err_generic')) end
    local owned = Phone.get(number, 'crypto') or {}
    local have, qty = tonumber(owned[coin.id]) or 0, usd / coin.price
    if data.sell then
        -- Exactly what is held and no more: any slack here is money for nothing on every round trip.
        if qty > have then return Phone.fail(L('err_generic')) end
        owned[coin.id] = math.max(0, have - qty)
        Phone.set(number, 'crypto', owned)
        Bridge.addBank(src, usd, 'phone-crypto')
    else
        if not Bridge.removeBank(src, usd, 'phone-crypto') then return Phone.fail(L('err_funds')) end
        owned[coin.id] = have + qty
        Phone.set(number, 'crypto', owned)
    end
    record(number, (data.sell and L('tx_sold') or L('tx_bought')):format(coin.id), data.sell and usd or -usd, src)
    return Phone.ok({ coins = coinSlice(number), wallet = Wallet.slice(src, number) })
end

-- App Store: community apps with a price --------------------------------------------------------------
-- ponytail: the price comes from the phone, because apps are registered on the client. A modified
-- client can get a paid app for free; it cannot be charged more than it asked to pay.
RPC['app.buy'] = function(src, number, data)
    local price = Util.int(data.price, 1, 100000000)
    if not price or not Bridge.has.money then return Phone.fail(L('err_generic')) end
    if not Bridge.removeBank(src, price, 'phone-app') then return Phone.fail(L('err_funds')) end
    record(number, L('tx_app'):format(Util.text(data.name, 1, 40) or '?'), -price, src)
    return Phone.ok({ wallet = Wallet.slice(src, number) })
end

-- Uploads -----------------------------------------------------------------------------------------
-- The token never leaves the server: the phone asks for a one-time upload link and posts the file to it.

RPC['upload'] = function()
    local token = Keys.fivemanage ~= '' and Keys.fivemanage or GetConvar('lwk_phone_fivemanage', '')
    if token == '' then return Phone.fail(L('err_no_upload')) end
    local p = promise.new()
    PerformHttpRequest('https://api.fivemanage.com/api/v3/file/presigned-url', function(status, body)
        local ok, res = pcall(json.decode, body or '')
        p:resolve(status == 200 and ok and res and res.data and res.data.presignedUrl or false)
    end, 'GET', '', { Authorization = token })
    local url = Citizen.Await(p)
    if not url then return Phone.fail(L('err_no_upload')) end
    return Phone.ok({ url = url })
end

-- AirShare: hand a photo, contact or note to someone standing next to you --------------------------

RPC['share.nearby'] = function(src)
    return Phone.ok({ people = near(src) })
end

local SHARE = { photo = true, contact = true, note = true, location = true, text = true }

RPC['share.send'] = function(src, _, data)
    local target, item = Util.int(data.to, 1, 65535), type(data.item) == 'table' and data.item or {}
    if not target or not isNear(src, target) or not SHARE[item.kind] then return Phone.fail(L('err_generic')) end
    Phone.push(target, { action = 'share', from = Bridge.name(src), item = {
        kind = item.kind, label = Util.text(item.label, 1, 120) or '', seed = Util.url(item.seed),
        name = Util.text(item.name, 1, 64), number = Util.number(item.number),
        title = Util.text(item.title, 0, 120), body = Util.text(item.body, 0, 4000),
        x = tonumber(item.x), y = tonumber(item.y),
    } })
    return Phone.ok()
end

-- Admin commands -----------------------------------------------------------------------------------

local function admin(src) return src == 0 or Bridge.isAdmin(src) end

--- /phoneverify <app> <username> <1|0>
RegisterCommand('phoneverify', function(src, args)
    if not admin(src) then return end
    local raw = MySQL.scalar.await('SELECT profile FROM lwk_phone_accounts WHERE app = ? AND username = ?', { args[1], args[2] })
    if not raw then return print('[lwk_phone] no such account') end
    local p = json.decode(raw) or {}
    p.verified = args[3] == '1'
    MySQL.update.await('UPDATE lwk_phone_accounts SET profile = ? WHERE app = ? AND username = ?', { json.encode(p), args[1], args[2] })
    print(('[lwk_phone] %s@%s verified = %s'):format(args[2], args[1], tostring(p.verified)))
end, false)

--- /phonepassword <app> <username> <new password>
RegisterCommand('phonepassword', function(src, args)
    if not admin(src) or not Util.text(args[3], 4, 64) then return end
    local n = MySQL.update.await('UPDATE lwk_phone_accounts SET password = ? WHERE app = ? AND username = ?', { GetPasswordHash(args[3]), args[1], args[2] })
    print(('[lwk_phone] password %s'):format(n > 0 and 'changed' or 'not changed: no such account'))
end, false)
