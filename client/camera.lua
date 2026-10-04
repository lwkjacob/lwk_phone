-- Camera mode. The game's own phone camera does the framing (and the selfie pose); the UI
-- draws that view inside the phone's viewfinder and captures it from there.
--
-- Aiming: Config.cursorKey hands the mouse back to the game. The rear camera then looks around
-- like first person. The selfie camera does not move on its own, so the mouse is turned into
-- movement of the phone around the player's face here.

Camera = {}

local on, selfie = false, false

-- Selfie framing. Each native takes one number and the game does not document its range.
-- If the phone moves too slowly, too fast, or stops short of where it should, tune these two.
local PAN_SPEED, PAN_LIMIT = 0.05, 1.0
local pan = { x = 0.0, y = 0.0 }

local function clamp(v) return math.max(-PAN_LIMIT, math.min(PAN_LIMIT, v)) end

local function frame()
    if not selfie or not GameHasMouse() then return end
    local dx, dy = GetDisabledControlNormal(0, 1), GetDisabledControlNormal(0, 2)   -- look left/right, up/down
    if dx == 0 and dy == 0 then return end
    pan.x, pan.y = clamp(pan.x + dx * PAN_SPEED), clamp(pan.y + dy * PAN_SPEED)
    CellCamSetHorizontalOffset(pan.x)
    CellCamSetVerticalOffset(pan.y)
end

local function recentre()
    pan.x, pan.y = 0.0, 0.0
    CellCamSetHorizontalOffset(0.0)
    CellCamSetVerticalOffset(0.0)
end

function Camera.start(front)
    local flipped = selfie ~= (front == true)
    selfie = front == true
    if on then
        CellCamActivateSelfieMode(selfie)
        if flipped then recentre() end
        return
    end
    on = true
    Prop.hide(true)
    CreateMobilePhone(0)
    CellCamActivate(true, true)
    CellCamActivateSelfieMode(selfie)
    recentre()
    CreateThread(function()
        while on do
            HideHudAndRadarThisFrame()
            frame()
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
    -- The game's phone took over the arm while the camera was up. Once it lets go, hold ours again.
    SetTimeout(250, function()
        if IsPhoneOpen() and not on then Prop.call(false) end
    end)
end

Local['camera'] = function(data)
    if not data.on then return Camera.stop() end
    Camera.start(data.selfie)
    return { ok = true, keys = { aim = KeyLabel(Keys.cursor), shutter = KeyLabel(Keys.shutter), flip = KeyLabel(Keys.flip) } }
end

-- With the mouse handed back to the game (Config.cursorKey) the shutter needs a key.
Keys.shutter = lib.addKeybind({
    name = 'lwk_phone_shutter',
    description = L('key_shutter'),
    defaultKey = 'RETURN',
    onPressed = function()
        if on then SendNUIMessage({ action = 'camera', event = 'shutter' }) end
    end,
})

Keys.flip = lib.addKeybind({
    name = 'lwk_phone_flip',
    description = L('key_flip'),
    defaultKey = 'UP',
    onPressed = function()
        if on then SendNUIMessage({ action = 'camera', event = 'flip' }) end
    end,
})
