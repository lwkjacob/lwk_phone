-- Framework bridge (server). Everything framework-specific lives here so the rest of the
-- resource only speaks: identifier, name, bank money, job, vehicles, admin.
-- Detected once: qbx_core > qb-core > es_extended > standalone. Config.framework can force one.
--
-- Standalone has no characters, money, jobs or owned vehicles: the identifier is the
-- player's licence and the apps that need the rest are hidden (see Bridge.has).

Bridge = Bridge or {}

local function present(res) return GetResourceState(res) ~= 'missing' end

local fw = Config.framework ~= 'auto' and Config.framework
    or (present('qbx_core') and 'qbox')
    or (present('qb-core') and 'qb')
    or (present('es_extended') and 'esx')
    or 'standalone'
Bridge.framework = fw

local QB, ESX
local function core()
    if fw == 'qb' and not QB then QB = exports['qb-core']:GetCoreObject() end
    if fw == 'esx' and not ESX then ESX = exports.es_extended:getSharedObject() end
end

local function player(src)
    core()
    if fw == 'qbox' then return exports.qbx_core:GetPlayer(src) end
    if fw == 'qb' then return QB.Functions.GetPlayer(src) end
    if fw == 'esx' then return ESX.GetPlayerFromId(src) end
end

--- What this server can do. The UI hides apps whose feature is missing.
Bridge.has = {
    money    = fw ~= 'standalone',
    jobs     = fw ~= 'standalone',
    vehicles = fw ~= 'standalone',
}

--- True once the player has a character (always true on standalone).
function Bridge.ready(src)
    if fw == 'standalone' then return GetPlayerName(src) ~= nil end
    return player(src) ~= nil
end

function Bridge.identifier(src)
    if fw == 'standalone' then
        return GetPlayerIdentifierByType(src, 'license') or GetPlayerIdentifierByType(src, 'fivem')
    end
    local p = player(src)
    if not p then return nil end
    if fw == 'esx' then return p.getIdentifier() end
    return p.PlayerData.citizenid
end

function Bridge.name(src)
    local p = player(src)
    if not p then return GetPlayerName(src) or 'Unknown' end
    if fw == 'esx' then return p.getName() end
    local c = p.PlayerData.charinfo or {}
    return (('%s %s'):format(c.firstname or '', c.lastname or ''):gsub('^%s+', ''):gsub('%s+$', ''))
end

-- Money: the phone only ever touches the bank account ------------------------------------

function Bridge.getBank(src)
    local p = player(src)
    if not p then return 0 end
    if fw == 'esx' then
        local acc = p.getAccount('bank')
        return acc and acc.money or 0
    end
    return p.Functions.GetMoney('bank') or 0
end

function Bridge.getCash(src)
    local p = player(src)
    if not p then return 0 end
    if fw == 'esx' then
        local acc = p.getAccount('money')
        return acc and acc.money or 0
    end
    return p.Functions.GetMoney('cash') or 0
end

function Bridge.addBank(src, amount, reason)
    local p = player(src)
    if not p or amount <= 0 then return false end
    if fw == 'esx' then
        p.addAccountMoney('bank', amount, reason)
        return true
    end
    return p.Functions.AddMoney('bank', amount, reason) ~= false
end

-- Checks the balance itself: never trust a framework to refuse an overdraft.
function Bridge.removeBank(src, amount, reason)
    local p = player(src)
    if not p or amount <= 0 or Bridge.getBank(src) < amount then return false end
    if fw == 'esx' then
        p.removeAccountMoney('bank', amount, reason)
        return true
    end
    return p.Functions.RemoveMoney('bank', amount, reason) == true
end

--- Bank money for a player who is not online: edit the stored JSON directly.
function Bridge.addBankOffline(identifier, amount)
    if amount <= 0 then return false end
    if fw == 'qb' or fw == 'qbox' then
        return MySQL.update.await(
            "UPDATE players SET money = JSON_SET(money, '$.bank', CAST(JSON_EXTRACT(money, '$.bank') AS SIGNED) + ?) WHERE citizenid = ?",
            { amount, identifier }) > 0
    end
    if fw == 'esx' then
        return MySQL.update.await(
            "UPDATE users SET accounts = JSON_SET(accounts, '$.bank', CAST(JSON_EXTRACT(accounts, '$.bank') AS SIGNED) + ?) WHERE identifier = ?",
            { amount, identifier }) > 0
    end
    return false
end

-- Jobs -----------------------------------------------------------------------------------------

--- { name, label, grade, gradeLabel, isBoss, duty } or nil. `duty` is nil where the framework has no duty.
function Bridge.getJob(src)
    local p = player(src)
    if not p then return nil end
    if fw == 'esx' then
        local j = p.getJob()
        return { name = j.name, label = j.label, grade = j.grade, gradeLabel = j.grade_label, isBoss = j.grade_name == 'boss' }
    end
    local j = p.PlayerData.job
    return {
        name = j.name, label = j.label, grade = j.grade and j.grade.level or 0, gradeLabel = j.grade and j.grade.name,
        isBoss = j.isboss == true, duty = j.onduty == true,
    }
end

--- Sources of every player working `job` right now (on duty, where duty exists).
function Bridge.onDuty(job)
    core()
    local out = {}
    if fw == 'esx' then
        for _, p in pairs(ESX.GetExtendedPlayers('job', job)) do out[#out + 1] = p.source end
    elseif fw == 'qb' or fw == 'qbox' then
        local players = fw == 'qb' and QB.Functions.GetQBPlayers() or exports.qbx_core:GetQBPlayers()
        for _, p in pairs(players) do
            local j = p.PlayerData.job
            if j.name == job and j.onduty then out[#out + 1] = p.PlayerData.source end
        end
    end
    return out
end

function Bridge.toggleDuty(src)
    if fw ~= 'qb' and fw ~= 'qbox' then return false end
    local p = player(src)
    if not p then return false end
    p.Functions.SetJobDuty(not p.PlayerData.job.onduty)
    return true
end

--- Give an online player a job and grade (hiring, firing, promoting). Returns success.
function Bridge.setJob(src, job, grade)
    local p = player(src)
    if not p then return false end
    if fw == 'esx' then
        p.setJob(job, grade)
        return true
    end
    return p.Functions.SetJob(job, grade) ~= false
end

--- Name of the "no job" job, for firing someone.
Bridge.unemployed = 'unemployed'

--- Everyone with `job`, online or not: { { id, name, grade, gradeLabel } }.
function Bridge.employees(job)
    local ok, rows
    if fw == 'esx' then
        ok, rows = pcall(MySQL.query.await, [[
            SELECT u.identifier AS id, CONCAT(u.firstname, ' ', u.lastname) AS name, u.job_grade AS grade, g.label AS gradeLabel
            FROM users u LEFT JOIN job_grades g ON g.job_name = u.job AND g.grade = u.job_grade WHERE u.job = ?]], { job })
    elseif fw == 'qb' or fw == 'qbox' then
        ok, rows = pcall(MySQL.query.await, [[
            SELECT citizenid AS id,
                   CONCAT(JSON_UNQUOTE(JSON_EXTRACT(charinfo, '$.firstname')), ' ', JSON_UNQUOTE(JSON_EXTRACT(charinfo, '$.lastname'))) AS name,
                   JSON_EXTRACT(job, '$.grade.level') AS grade, JSON_UNQUOTE(JSON_EXTRACT(job, '$.grade.name')) AS gradeLabel
            FROM players WHERE JSON_UNQUOTE(JSON_EXTRACT(job, '$.name')) = ?]], { job })
    end
    return ok and rows or {}
end

--- Source of an online character by identifier, or nil.
function Bridge.sourceOf(identifier)
    core()
    if fw == 'qbox' then
        local p = exports.qbx_core:GetPlayerByCitizenId(identifier)
        return p and p.PlayerData.source
    elseif fw == 'qb' then
        local p = QB.Functions.GetPlayerByCitizenId(identifier)
        return p and p.PlayerData.source
    elseif fw == 'esx' then
        local p = ESX.GetPlayerFromIdentifier(identifier)
        return p and p.source
    end
    for _, src in ipairs(GetPlayers()) do
        if Bridge.identifier(tonumber(src)) == identifier then return tonumber(src) end
    end
end

-- Vehicles ---------------------------------------------------------------------------------------
-- Rows come back as { plate, model, garage, state = 'out' | 'garaged' | 'impound', held, fuel, engine, body, props }.
-- `model` is a spawn name or hash; the client turns it into a display name. `props` is the saved
-- tuning, handed back to the client when the valet spawns the vehicle.
--
-- Garage scripts all keep vehicles in the framework's table (player_vehicles / owned_vehicles) and
-- differ in which columns say where a vehicle is. Rather than naming scripts, this reads whichever
-- of those columns the table has:
--   in_garage, garage_id, impound     jg-advancedgarages, cd_garage
--   state, garage                     qb-garages, qbx_garages (0 out, 1 garaged, 2 impound)
--   stored, parking, pound            esx_garage and most ESX garages
--   parking                           okokGarage (next to state / stored)
-- A garage script with other columns: edit `where` and Bridge.vehicleOut below.

local TABLE = fw == 'esx' and 'owned_vehicles' or 'player_vehicles'
local OWNER = fw == 'esx' and 'owner' or 'citizenid'
local cols

--- The vehicle table's columns, as a set. Read once.
local function columns()
    if cols then return cols end
    local found = {}
    local ok, rows = pcall(MySQL.query.await, ('SHOW COLUMNS FROM %s'):format(TABLE))
    for _, r in ipairs(ok and rows or {}) do found[r.Field] = true end
    if next(found) then cols = found end
    return found
end

local function yes(v) return v == true or v == 1 end

--- Where a vehicle is: state, garage name, and whether it is held in an impound it may not leave.
local function where(r, c)
    local garage = r.garage_id or r.parking or r.garage or ''
    if c.garage_id and GetResourceState('cd_garage') == 'started' then
        local ok, label = pcall(function() return exports.cd_garage:GetGarageLabelFromGarageId(r.garage_id) end)
        if ok and type(label) == 'string' then garage = label end
    end
    if c.impound and (tonumber(r.impound) or 0) > 0 then
        return 'impound', garage, c.impound_retrievable and not yes(tonumber(r.impound_retrievable))
    end
    if c.in_garage then return yes(tonumber(r.in_garage) or r.in_garage) and 'garaged' or 'out', garage end
    if c.state then return r.state == 0 and 'out' or r.state == 2 and 'impound' or 'garaged', garage end
    if c.pound and r.pound and r.pound ~= '' then return 'impound', r.pound end
    if c.stored then
        local stored = tonumber(r.stored) or (r.stored and 1 or 0)
        return stored == 0 and 'out' or stored == 2 and 'impound' or 'garaged', garage
    end
    return 'garaged', garage
end

local function decode(text)
    local ok, t = pcall(json.decode, text or '')
    return ok and type(t) == 'table' and t or {}
end

function Bridge.vehicles(src)
    local out = {}
    if fw == 'standalone' then return out end
    local c = columns()
    local ok, rows = pcall(MySQL.query.await, ('SELECT * FROM %s WHERE %s = ?'):format(TABLE, OWNER), { Bridge.identifier(src) })
    for _, r in ipairs(ok and rows or {}) do
        -- QBCore keeps the spawn name in `vehicle` and the tuning in `mods`; ESX keeps the tuning, model included, in `vehicle`.
        local props = decode(fw == 'esx' and r.vehicle or r.mods)
        local state, garage, held = where(r, c)
        out[#out + 1] = {
            plate = r.plate, model = fw == 'esx' and props.model or r.vehicle or tonumber(r.hash), garage = garage, state = state, held = held or nil,
            fuel = math.floor(tonumber(r.fuel) or props.fuelLevel or 100),
            engine = math.floor((tonumber(r.engine) or props.engineHealth or 1000) / 10),
            body = math.floor((tonumber(r.body) or props.bodyHealth or 1000) / 10),
            props = props,
        }
    end
    return out
end

-- The columns that say where a vehicle is, and what each holds while the vehicle is out.
local OUT = { { 'in_garage', '0' }, { 'impound', '0' }, { 'state', '0' }, { 'stored', '0' }, { 'pound', 'NULL' } }

--- Mark a vehicle as out of its garage / released from impound. Returns what those columns held
--- before (for Bridge.vehicleBack), or false when nothing was changed.
function Bridge.vehicleOut(src, plate)
    if fw == 'standalone' then return false end
    local c, names, sets = columns(), {}, {}
    for _, o in ipairs(OUT) do
        if c[o[1]] then
            names[#names + 1] = o[1]
            sets[#sets + 1] = o[1] .. ' = ' .. o[2]
        end
    end
    if #sets == 0 then return false end
    local owner = Bridge.identifier(src)
    local before = MySQL.single.await(('SELECT %s FROM %s WHERE plate = ? AND %s = ?'):format(table.concat(names, ', '), TABLE, OWNER), { plate, owner })
    if not before then return false end
    local changed = MySQL.update.await(('UPDATE %s SET %s WHERE plate = ? AND %s = ?'):format(TABLE, table.concat(sets, ', '), OWNER), { plate, owner })
    return changed > 0 and before
end

--- Undo Bridge.vehicleOut: put the vehicle back where it was. `before` is what vehicleOut returned.
function Bridge.vehicleBack(src, plate, before)
    local c, sets, params = columns(), {}, {}
    for _, o in ipairs(OUT) do
        local name, v = o[1], before[o[1]]
        if c[name] and v == nil then
            sets[#sets + 1] = name .. ' = NULL'
        elseif c[name] then
            sets[#sets + 1] = name .. ' = ?'
            params[#params + 1] = v == true and 1 or v == false and 0 or v
        end
    end
    params[#params + 1], params[#params + 2] = plate, Bridge.identifier(src)
    return MySQL.update.await(('UPDATE %s SET %s WHERE plate = ? AND %s = ?'):format(TABLE, table.concat(sets, ', '), OWNER), params) > 0
end

-- Garage scripts this phone can name in the start-up report. Naming one changes nothing: what
-- matters is the columns (see above), and those are read whatever the script is called.
local GARAGES = { 'jg-advancedgarages', 'cd_garage', 'okokGarage', 'qbx_garages', 'qb-garages', 'esx_garage' }

--- What the Garage app is working with, for the start-up report: { script = name or nil, table, columns = { names } }.
function Bridge.garage()
    local script
    for _, res in ipairs(GARAGES) do
        if GetResourceState(res) == 'started' then script = res break end
    end
    local c, found = columns(), {}
    for _, o in ipairs(OUT) do
        if c[o[1]] then found[#found + 1] = o[1] end
    end
    return { script = script, table = TABLE, columns = found }
end

function Bridge.isAdmin(src)
    return IsPlayerAceAllowed(src, Config.adminAce)
end
