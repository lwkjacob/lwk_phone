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
-- Rows come back as { plate, model, garage, state = 'out' | 'garaged' | 'impound', fuel, engine, body, props }.
-- `model` is a spawn name or hash; the client turns it into a display name. `props` is the saved
-- tuning, handed back to the client when the valet spawns the vehicle.

function Bridge.vehicles(src)
    local id = Bridge.identifier(src)
    local out = {}
    if fw == 'qb' or fw == 'qbox' then
        local ok, rows = pcall(MySQL.query.await, 'SELECT vehicle, hash, plate, garage, fuel, engine, body, state, mods FROM player_vehicles WHERE citizenid = ?', { id })
        for _, r in ipairs(ok and rows or {}) do
            out[#out + 1] = {
                plate = r.plate, model = r.vehicle or tonumber(r.hash), garage = r.garage or '',
                state = r.state == 0 and 'out' or r.state == 2 and 'impound' or 'garaged',
                fuel = math.floor(r.fuel or 100), engine = math.floor((r.engine or 1000) / 10), body = math.floor((r.body or 1000) / 10),
                props = r.mods and json.decode(r.mods) or nil,
            }
        end
    elseif fw == 'esx' then
        local ok, rows = pcall(MySQL.query.await, 'SELECT plate, vehicle, stored, parking, pound FROM owned_vehicles WHERE owner = ?', { id })
        for _, r in ipairs(ok and rows or {}) do
            local props = r.vehicle and json.decode(r.vehicle) or {}
            out[#out + 1] = {
                plate = r.plate, model = props.model, garage = r.parking or r.pound or '',
                state = (r.pound and r.pound ~= '') and 'impound' or (r.stored == 1 or r.stored == true) and 'garaged' or 'out',
                fuel = math.floor(props.fuelLevel or 100), engine = math.floor((props.engineHealth or 1000) / 10), body = math.floor((props.bodyHealth or 1000) / 10),
                props = props,
            }
        end
    end
    return out
end

--- Mark a vehicle as out of its garage / released from impound. Returns success.
function Bridge.vehicleOut(src, plate)
    local id = Bridge.identifier(src)
    if fw == 'qb' or fw == 'qbox' then
        return MySQL.update.await('UPDATE player_vehicles SET state = 0 WHERE plate = ? AND citizenid = ?', { plate, id }) > 0
    elseif fw == 'esx' then
        return MySQL.update.await('UPDATE owned_vehicles SET stored = 0, pound = NULL WHERE plate = ? AND owner = ?', { plate, id }) > 0
    end
    return false
end

function Bridge.isAdmin(src)
    return IsPlayerAceAllowed(src, Config.adminAce)
end
