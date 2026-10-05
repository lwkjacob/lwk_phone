-- Banking bridge (server).
--
-- A player's own balance is framework bank money with every bank script, so Wallet works with
-- all of them and needs nothing from this file. What differs per bank is:
--   1. where a job's money lives (the Company Account under Services > My Job), and
--   2. how to add a line to the history the bank shows in its own app.
--
-- Supported: lwk_bank, Renewed-Banking, qb-banking, okokBanking, qb-management, esx_addonaccount.
-- For another bank, set Config.bank = 'none' and fill in the three Bank.* functions below.

Bank = {}

-- lwk_bank also answers to the other banks' names, so it is looked for first.
local ORDER = { 'lwk_bank', 'Renewed-Banking', 'qb-banking', 'okokBanking', 'qb-management', 'esx_addonaccount' }
local kind

--- Which bank is running. Worked out on first use, by which time every resource has started.
function Bank.kind()
    if kind then return kind end
    kind = Config.bank ~= 'auto' and Config.bank or 'none'
    if Config.bank == 'auto' then
        for _, res in ipairs(ORDER) do
            if GetResourceState(res) == 'started' then kind = res break end
        end
    end
    return kind
end

local function addon(job)
    local account
    TriggerEvent('esx_addonaccount:getSharedAccount', 'society_' .. job, function(a) account = a end)
    return account
end

--- Balance of a job's company account, or nil when there is no such account (or no bank).
function Bank.balance(job)
    local k = Bank.kind()
    local ok, v = pcall(function()
        if k == 'lwk_bank' then return exports.lwk_bank:GetBusinessBalance(job) end
        if k == 'Renewed-Banking' then return exports['Renewed-Banking']:getAccountMoney(job) end
        if k == 'qb-banking' then return exports['qb-banking']:GetAccountBalance(job) end
        if k == 'okokBanking' then return exports.okokBanking:GetAccount(job) end
        if k == 'qb-management' then return exports['qb-management']:GetAccount(job) end
        if k == 'esx_addonaccount' then
            local a = addon(job)
            return a and a.money
        end
    end)
    return ok and tonumber(v) or nil
end

local function move(job, amount, reason, add)
    local k = Bank.kind()
    local ok, v = pcall(function()
        if k == 'lwk_bank' then
            if add then return exports.lwk_bank:AddBusinessMoney(job, amount, reason) end
            return exports.lwk_bank:RemoveBusinessMoney(job, amount, reason)
        elseif k == 'Renewed-Banking' then
            if add then return exports['Renewed-Banking']:addAccountMoney(job, amount) end
            return exports['Renewed-Banking']:removeAccountMoney(job, amount)
        elseif k == 'qb-banking' then
            if add then return exports['qb-banking']:AddMoney(job, amount, reason) end
            return exports['qb-banking']:RemoveMoney(job, amount, reason)
        elseif k == 'okokBanking' or k == 'qb-management' then
            -- Neither says whether it worked: no error is taken as success.
            if add then exports[k]:AddMoney(job, amount) else exports[k]:RemoveMoney(job, amount) end
            return true
        elseif k == 'esx_addonaccount' then
            local a = addon(job)
            if not a then return false end
            if add then a.addMoney(amount) else a.removeMoney(amount) end
            return true
        end
        return false
    end)
    return ok and v ~= nil and v ~= false and v ~= 0
end

function Bank.add(job, amount, reason)
    return move(job, amount, reason, true)
end

-- Checks the balance itself: not every bank refuses an overdraft.
function Bank.remove(job, amount, reason)
    local have = Bank.balance(job)
    if not have or have < amount then return false end
    return move(job, amount, reason, false)
end

--- Add a line to the player's history in the bank's own app. The money has already moved;
--- `amount` is negative for money leaving the player.
-- ponytail: Renewed-Banking and qb-banking only. lwk_bank lists framework money movements by
-- itself; okokBanking's history call is not public, so phone payments do not show there.
function Bank.statement(src, amount, label)
    local k, out = Bank.kind(), amount < 0
    pcall(function()
        if k == 'Renewed-Banking' then
            local name = Bridge.name(src)
            exports['Renewed-Banking']:handleTransaction(Bridge.identifier(src), label, math.abs(amount), label,
                out and name or label, out and label or name, out and 'withdraw' or 'deposit')
        elseif k == 'qb-banking' then
            exports['qb-banking']:CreateBankStatement(src, 'checking', math.abs(amount), label, out and 'withdraw' or 'deposit', 'player')
        end
    end)
end
