-- Housing bridge (server). The Home app is hidden until this file is filled in for your
-- housing script: there is no common API across housing resources, so nothing is guessed here.
--
-- To enable the app, set Housing.enabled = true and implement the four functions.
-- A house is { id, name, addr, locked = bool, lights = bool, keys = { '<phone number>', ... }, x, y }.

Housing = { enabled = false }

--- Houses the player owns.
function Housing.list(src)
    return {}
end

--- Lock or unlock. Returns the new locked state, or nil if it could not be changed.
function Housing.setLocked(src, houseId, locked)
    return nil
end

--- Give a key to the holder of `number`. Returns success.
function Housing.addKey(src, houseId, number)
    return false
end

--- Take a key back. Returns success.
function Housing.removeKey(src, houseId, number)
    return false
end
