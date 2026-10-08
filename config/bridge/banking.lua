-- Banking bridge (server).
--
-- A player's own balance is framework bank money with every bank script, so Wallet works with
-- all of them and needs nothing from this file. What differs per bank is:
--   1. where a job's money lives (the Company Account under Services > My Job), and
--   2. how to add a line to the history the bank shows in its own app.
--
--   bank               written from
--   lwk_bank           its source
--   Renewed-Banking    its source
--   qb-banking         its source
--   qb-management      its source
--   okokBanking        its documentation
--   wasabi_banking     its documentation
--   tgg-banking        its documentation
--   p_banking          its documentation
--   fd_banking         other open-source bridges (its own documentation is not public)
--   tgiann-bank        other open-source bridges (its documentation could not be read)
--   esx_addonaccount   its source. This is also where esx_society keeps a job's money (`society_<job>`).
--   ox_core            its source: a group's own account (the group needs `hasAccount`)
--
-- For another bank, set Config.bank = 'none' and fill in the three Bank.* functions below.

Bank = {}

-- lwk_bank also answers to the other banks' names, so it is looked for first.
-- esx_addonaccount is last: on ESX it runs under every bank above, and they are the ones holding the money then.
local ORDER = {
    'lwk_bank', 'Renewed-Banking', 'qb-banking', 'okokBanking', 'wasabi_banking', 'tgg-banking', 'p_banking', 'fd_banking', 'tgiann-bank',
    'qb-management', 'esx_addonaccount', 'ox_core',
}
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
        if k == 'wasabi_banking' then return exports.wasabi_banking:GetAccountBalance(job, 'society') end
        if k == 'tgg-banking' then return exports['tgg-banking']:GetSocietyAccountMoney(job) end
        if k == 'p_banking' then return exports['p_banking']:getAccountMoney(job) end
        if k == 'fd_banking' then return exports['fd_banking']:GetAccount(job) end
        if k == 'tgiann-bank' then return exports['tgiann-bank']:GetJobAccountBalance(job) end
        if k == 'qb-management' then return exports['qb-management']:GetAccount(job) end
        if k == 'esx_addonaccount' then
            local a = addon(job)
            return a and a.money
        end
        if k == 'ox_core' then
            local a = exports.ox_core:GetGroupAccount(job)
            return a and exports.ox_core:CallAccount(a.accountId, 'get', 'balance')
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
        elseif k == 'wasabi_banking' then
            if add then return exports.wasabi_banking:AddMoney('society', job, amount) end
            return exports.wasabi_banking:RemoveMoney('society', job, amount)
        elseif k == 'tgg-banking' then
            if add then return exports['tgg-banking']:AddSocietyMoney(job, amount) end
            return exports['tgg-banking']:RemoveSocietyMoney(job, amount)
        elseif k == 'p_banking' then
            if add then return exports['p_banking']:addAccountMoney(job, amount) end
            return exports['p_banking']:removeAccountMoney(job, amount)
        elseif k == 'fd_banking' then
            if add then return exports['fd_banking']:AddMoney(job, amount, reason) end
            return exports['fd_banking']:RemoveMoney(job, amount, reason)
        elseif k == 'tgiann-bank' then
            -- Not known to say whether it worked: no error is taken as success.
            if add then exports['tgiann-bank']:AddJobMoney(job, amount) else exports['tgiann-bank']:RemoveJobMoney(job, amount) end
            return true
        elseif k == 'okokBanking' or k == 'qb-management' then
            -- Neither says whether it worked: no error is taken as success.
            if add then exports[k]:AddMoney(job, amount) else exports[k]:RemoveMoney(job, amount) end
            return true
        elseif k == 'esx_addonaccount' then
            local a = addon(job)
            if not a then return false end
            if add then a.addMoney(amount) else a.removeMoney(amount) end
            return true
        elseif k == 'ox_core' then
            local a = exports.ox_core:GetGroupAccount(job)
            local res = a and exports.ox_core:CallAccount(a.accountId, add and 'addBalance' or 'removeBalance', { amount = amount, message = reason })
            return type(res) == 'table' and res.success == true
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
-- ponytail: Renewed-Banking, qb-banking and wasabi_banking only. lwk_bank lists framework money
-- movements by itself; tgg-banking and p_banking want the account's IBAN, which the phone does not
-- know; the others have no public call for it. There, phone payments do not show in the bank's history.
function Bank.statement(src, amount, label)
    local k, out = Bank.kind(), amount < 0
    pcall(function()
        if k == 'Renewed-Banking' then
            local name = Bridge.name(src)
            exports['Renewed-Banking']:handleTransaction(Bridge.identifier(src), label, math.abs(amount), label,
                out and name or label, out and label or name, out and 'withdraw' or 'deposit')
        elseif k == 'qb-banking' then
            exports['qb-banking']:CreateBankStatement(src, 'checking', math.abs(amount), label, out and 'withdraw' or 'deposit', 'player')
        elseif k == 'wasabi_banking' then
            exports.wasabi_banking:Transaction(Bridge.identifier(src), label, math.abs(amount), out and 'sent' or 'deposit', 'personal')
        end
    end)
end
