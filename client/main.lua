-- The phone on the player's side: raising and lowering it, who gets the mouse and keyboard,
-- and the pipe between the UI and the server.
--
-- UI -> here:  NUI callbacks 'ready', 'rpc', 'close', 'typing', 'customApp'
-- here -> UI:  SendNUIMessage({ action = ... })   (see web/src/nui.ts)

Local = {}   -- rpc name -> function(data): handled here instead of on the server (needs game natives)
After = {}   -- rpc name -> function(result, data): touches up a server answer before the UI sees it

local isOpen, uiReady, loaded = false, false, false
local typing, cursorOff = false, false

local function nui(msg) SendNUIMessage(msg) end

function IsPhoneOpen() return isOpen end

--- Hand out mouse and keyboard. With Config.walk the game keeps the keyboard so the player can
--- move; while a text field has focus it does not, or typing would walk the character about.
local function focus()
    SetNuiFocus(isOpen, isOpen and not cursorOff)
    SetNuiFocusKeepInput(isOpen and (Config.walk or cursorOff) and not typing)
end

--- Fetch the phone from the server and hand it to the UI. `slot` is the inventory slot just used.
local function load(slot)
    local data = lib.callback.await('lwk_phone:load', false, slot)
    if not data or data.error then
        loaded = false
        return false, data and data.error
    end
    loaded = true
    nui({ action = 'init', data = data })
    CustomApps.resend()
    return true
end

function ClosePhone()
    if not isOpen then return end
    isOpen, typing, cursorOff = false, false, false
    nui({ action = 'close' })
    focus()
    Camera.stop()
    Prop.lower()
end

function OpenPhone(slot)
    if isOpen or not uiReady or not Bridge.canOpen() then return end
    if not loaded or slot then
        local ok, why = load(slot)
        if not ok then
            if why == 'no_phone' then lib.notify({ description = L('err_no_phone'), type = 'error' }) end
            return
        end
    end
    isOpen = true
    nui({ action = 'open' })
    focus()
    Prop.raise()
end

local function unload()
    ClosePhone()
    loaded = false
    nui({ action = 'unload' })
end

-- Keys ---------------------------------------------------------------------------------------

lib.addKeybind({
    name = 'lwk_phone',
    description = L('key_open'),
    defaultKey = Config.keybind,
    onPressed = function()
        if isOpen then ClosePhone() else OpenPhone() end
    end,
})

-- Gives the mouse back to the game while the phone stays up: look around, aim the camera.
lib.addKeybind({
    name = 'lwk_phone_cursor',
    description = L('key_cursor'),
    defaultKey = Config.cursorKey,
    onPressed = function()
        if not isOpen then return end
        cursorOff = not cursorOff
        focus()
    end,
})

RegisterCommand(Config.command, function()
    if isOpen then ClosePhone() else OpenPhone() end
end, false)

-- While the game still has the keyboard, stop it acting on clicks and keys meant for the phone.
CreateThread(function()
    while true do
        if isOpen and not typing then
            if not cursorOff then
                DisableControlAction(0, 1, true)    -- look left/right
                DisableControlAction(0, 2, true)    -- look up/down
            end
            DisableControlAction(0, 24, true)       -- attack
            DisableControlAction(0, 25, true)       -- aim
            DisableControlAction(0, 37, true)       -- weapon wheel
            DisableControlAction(0, 140, true)      -- melee
            DisableControlAction(0, 141, true)
            DisableControlAction(0, 142, true)
            DisableControlAction(0, 199, true)      -- pause (P)
            DisableControlAction(0, 200, true)      -- pause (ESC)
            DisableControlAction(0, 257, true)      -- attack 2
            Wait(0)
        else
            Wait(250)
        end
    end
end)

-- Put the phone away when the player can no longer hold it (death, cuffs).
CreateThread(function()
    while true do
        Wait(500)
        if isOpen and not Bridge.canOpen() then ClosePhone() end
    end
end)

-- UI -> Lua -----------------------------------------------------------------------------------

RegisterNUICallback('ready', function(_, cb)
    uiReady = true
    cb({})
end)

RegisterNUICallback('rpc', function(req, cb)
    local name, data = req.name, type(req.data) == 'table' and req.data or {}
    if Local[name] then return cb(Local[name](data) or { ok = true }) end
    local res = lib.callback.await('lwk_phone:rpc', false, name, data) or { ok = false }
    if After[name] and res.ok then res = After[name](res, data) or res end
    cb(res)
end)

RegisterNUICallback('close', function(_, cb)
    ClosePhone()
    cb({})
end)

RegisterNUICallback('typing', function(data, cb)
    typing = data.on == true
    focus()
    cb({})
end)

RegisterNUICallback('customApp', function(data, cb)
    CustomApps.event(data)
    cb({})
end)

-- Server -> UI ---------------------------------------------------------------------------------

RegisterNetEvent('lwk_phone:nui', function(msg)
    if msg.action == 'unload' then return unload() end
    nui(msg)
end)

-- The phone item was used (qb-inventory; ox_inventory calls the usePhone export instead).
RegisterNetEvent('lwk_phone:use', function(slot)
    if isOpen then ClosePhone() else OpenPhone(slot) end
end)

-- Character lifecycle ----------------------------------------------------------------------------

Bridge.watch(function()
    if uiReady and not loaded then load() end
end, function()
    unload()
    TriggerServerEvent('lwk_phone:unload')
end)

-- Covers standalone servers and resource restarts, where no "loaded" event will arrive.
CreateThread(function()
    while not uiReady or not Bridge.loaded() do Wait(500) end
    if not loaded then load() end
end)

AddEventHandler('onResourceStop', function(res)
    if res ~= GetCurrentResourceName() then return end
    if isOpen then SetNuiFocus(false, false) end
    Camera.stop()
    Prop.destroy()
end)
