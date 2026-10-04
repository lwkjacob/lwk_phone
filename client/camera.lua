-- Camera mode. The game's own phone camera does the framing (and the selfie pose); the UI
-- draws that view inside the phone's viewfinder and captures it from there.

Camera = {}

local on, selfie = false, false

function Camera.start(front)
    selfie = front == true
    if on then return CellCamActivateSelfieMode(selfie) end
    on = true
    Prop.hide(true)
    CreateMobilePhone(0)
    CellCamActivate(true, true)
    CellCamActivateSelfieMode(selfie)
    CreateThread(function()
        while on do
            HideHudAndRadarThisFrame()
            Wait(0)
        end
    end)
end

function Camera.stop()
    if not on then return end
    on = false
    CellCamActivate(false, false)
    DestroyMobilePhone()
    Prop.hide(false)
end

Local['camera'] = function(data)
    if data.on then Camera.start(data.selfie) else Camera.stop() end
end

-- With the mouse handed back to the game (Config.cursorKey) the shutter needs a key.
lib.addKeybind({
    name = 'lwk_phone_shutter',
    description = L('key_shutter'),
    defaultKey = 'RETURN',
    onPressed = function()
        if on then SendNUIMessage({ action = 'camera', event = 'shutter' }) end
    end,
})

lib.addKeybind({
    name = 'lwk_phone_flip',
    description = L('key_flip'),
    defaultKey = 'UP',
    onPressed = function()
        if on then SendNUIMessage({ action = 'camera', event = 'flip' }) end
    end,
})
