-- Calls. The server owns who is ringing whom; voice itself is the voice script's job
-- (config/bridge/voice.lua). Video rides WebRTC between the two phones: the server only
-- relays the handshake.

Calls = {}

local calls  = {}   -- id -> { id, caller, callee, targets = { number... }, video, hidden, company, state, started, answered }
local inCall = {}   -- number -> call id
local nextId = 0
local CHANNEL = 4200   -- voice channel offset, clear of radio frequencies other scripts use

function Calls.active(number) return calls[inCall[number] or 0] end

--- Recent calls for the Phone app, from this phone's point of view.
function Calls.log(number)
    local out = {}
    for i, r in ipairs(MySQL.query.await('SELECT * FROM lwk_phone_calls WHERE caller = ? OR callee = ? ORDER BY id DESC LIMIT 60', { number, number })) do
        local outgoing = r.caller == number
        out[i] = {
            id = r.id, time = r.created, video = r.video == 1 or r.video == true or nil,
            dur = r.duration > 0 and r.duration or nil,
            dir = outgoing and 'out' or r.answered ~= 0 and r.answered ~= false and 'in' or 'missed',
            number = outgoing and r.callee or (r.hidden ~= 0 and r.hidden ~= false) and L('no_caller_id') or r.caller,
        }
    end
    return out
end

local function finish(call, by)
    calls[call.id] = nil
    local duration = call.answered and os.time() - call.answered or 0
    local parties = { call.caller, table.unpack(call.targets) }
    for _, n in ipairs(parties) do
        inCall[n] = nil
        local src = Phone.source(n)
        if src then
            pcall(Voice.set, src, 0)
            if n ~= by then Phone.push(src, { action = 'call', event = 'ended' }) end
        end
    end
    MySQL.insert('INSERT INTO lwk_phone_calls (caller, callee, video, hidden, answered, duration, created) VALUES (?, ?, ?, ?, ?, ?, ?)',
        { call.caller, call.callee, call.video and 1 or 0, call.hidden and 1 or 0, call.answered and 1 or 0, duration, call.started * 1000 })
end

--- Ring `callee` (a number) or every on-duty employee of a company. Used by the UI and the CreateCall export.
function Calls.start(number, opts)
    if inCall[number] then return nil, L('err_busy') end
    if Phone.flags(number).airplane then return nil, L('err_airplane') end

    local targets, callee, company = {}, nil, nil
    local function free(n) return n ~= number and Phone.source(n) and not inCall[n] and not Phone.flags(n).airplane end

    if opts.company then
        for _, c in ipairs(Config.companies) do
            if c.job == opts.company then company = c end
        end
        if not company then return nil, L('err_generic') end
        callee = company.name:sub(1, 16)
        for _, src in ipairs(Bridge.onDuty(company.job)) do
            local n = Phone.number(src)
            if n and free(n) then targets[#targets + 1] = n end
        end
    else
        callee = Util.number(opts.number)
        if not callee or callee == number then return nil, L('err_number') end
        if free(callee) then targets[1] = callee end
    end

    nextId = nextId + 1
    local call = {
        id = nextId, caller = number, callee = callee, targets = targets, company = company ~= nil,
        video = opts.video == true, hidden = opts.hidden == true or Phone.flags(number).hideCallerId,
        state = 'ringing', started = os.time(),
    }
    calls[call.id], inCall[number] = call, call.id
    for _, n in ipairs(targets) do
        inCall[n] = call.id
        Phone.push(n, { action = 'call', event = 'incoming', number = call.hidden and L('no_caller_id') or number, video = call.video })
    end
    return call
end

RPC['call.start'] = function(_, number, data)
    local call, err = Calls.start(number, data)
    if not call then return Phone.fail(err) end
    return Phone.ok()
end

RPC['call.answer'] = function(src, number)
    local call = Calls.active(number)
    if not call or call.state ~= 'ringing' or call.caller == number then return Phone.fail(L('err_generic')) end
    call.state, call.answered = 'active', os.time()
    -- A company call rings every employee: the first to pick up takes it, the rest stop ringing.
    for _, n in ipairs(call.targets) do
        if n ~= number then
            inCall[n] = nil
            Phone.push(n, { action = 'call', event = 'ended' })
        end
    end
    call.targets = { number }
    if call.company then call.callee = number end

    local caller = Phone.source(call.caller)
    Voice.set(src, CHANNEL + call.id)
    if caller then Voice.set(caller, CHANNEL + call.id) end
    Phone.push(call.caller, { action = 'call', event = 'answered', peer = number })
    return Phone.ok({ peer = call.hidden and '' or call.caller })
end

RPC['call.end'] = function(_, number)
    local call = Calls.active(number)
    if not call then return Phone.ok() end
    -- One employee declining a company call does not end it for the others.
    if call.state == 'ringing' and call.company and number ~= call.caller and #call.targets > 1 then
        for i, n in ipairs(call.targets) do
            if n == number then table.remove(call.targets, i) break end
        end
        inCall[number] = nil
        return Phone.ok()
    end
    finish(call, number)
    return Phone.ok()
end

--- WebRTC handshake relay (video calls, live streams). The media never touches the server.
--- Peers are named by role, not number: 'call' is the other end of the caller's active call,
--- 'lumen:<user>' is someone in the same live stream.
RPC['rtc'] = function(_, number, data)
    if type(data.signal) ~= 'table' or type(data.to) ~= 'string' then return Phone.fail(L('err_generic')) end
    if data.to == 'call' then
        local call = Calls.active(number)
        if not call or call.state ~= 'active' then return Phone.fail(L('err_generic')) end
        Phone.push(call.caller == number and call.targets[1] or call.caller, { action = 'rtc', from = 'call', signal = data.signal })
    else
        local to, from = Social.livePeer(number, data.to)
        if not to then return Phone.fail(L('err_generic')) end
        Messages.push(to, { action = 'rtc', from = from, signal = data.signal })
    end
    return Phone.ok()
end

AddEventHandler('lwk_phone:dropped', function(_, number)
    local call = Calls.active(number)
    if call then finish(call, number) end
end)

-- Unanswered calls stop ringing and become missed calls.
CreateThread(function()
    while true do
        Wait(2000)
        local now = os.time()
        for _, call in pairs(calls) do
            if call.state == 'ringing' and now - call.started >= Config.calls.ringSeconds then finish(call) end
        end
    end
end)
