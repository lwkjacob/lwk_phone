-- Voice bridge (server): puts two players in a private call channel.
-- pma-voice does this with one export. With no voice script, calls still connect but are silent.

Voice = {}

local kind = Config.calls.voice ~= 'auto' and Config.calls.voice
    or (GetResourceState('pma-voice') ~= 'missing' and 'pma')
    or 'none'
Voice.kind = kind

--- `channel` is any positive number unique to the call; 0 leaves the call.
function Voice.set(src, channel)
    if kind == 'pma' then exports['pma-voice']:setPlayerCall(src, channel) end
end
