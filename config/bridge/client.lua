-- Framework bridge (client): when the player's character is ready, when it goes away, and
-- the few things that differ per framework on the client.

Bridge = Bridge or {}

local function present(res) return GetResourceState(res) ~= 'missing' end

local fw = Config.framework ~= 'auto' and Config.framework
    or (present('qbx_core') and 'qbox')
    or (present('qb-core') and 'qb')
    or (present('es_extended') and 'esx')
    or 'standalone'
Bridge.framework = fw

local ESX = fw == 'esx' and exports.es_extended:getSharedObject() or nil

--- True when a character is in the world.
function Bridge.loaded()
    if fw == 'esx' then return ESX.IsPlayerLoaded() end
    if fw == 'qb' or fw == 'qbox' then return LocalPlayer.state.isLoggedIn == true end
    return NetworkIsPlayerActive(PlayerId())
end

--- onLoad: a character finished loading. onUnload: logged out or switched character.
function Bridge.watch(onLoad, onUnload)
    if fw == 'esx' then
        RegisterNetEvent('esx:playerLoaded', onLoad)
        RegisterNetEvent('esx:onPlayerLogout', onUnload)
    elseif fw == 'qb' or fw == 'qbox' then
        RegisterNetEvent('QBCore:Client:OnPlayerLoaded', onLoad)
        RegisterNetEvent('QBCore:Client:OnPlayerUnload', onUnload)
    end
end

--- Whether the phone may be raised right now. Add your own checks (cuffed, in a menu...).
function Bridge.canOpen()
    local ped = PlayerPedId()
    return not IsEntityDead(ped) and not IsPedCuffed(ped) and not IsPauseMenuActive()
end

--- Called after the valet spawns a vehicle, to hand the player its keys.
--- An event nothing listens for does nothing, so each key script's own event is simply fired.
--- For a key script that needs something else, add its call here.
function Bridge.giveKeys(vehicle, plate)
    TriggerEvent('vehiclekeys:client:SetOwner', plate)   -- qb-vehiclekeys, qbx_vehiclekeys, and key scripts that copy them
    TriggerEvent('cd_garage:AddKeys', plate)
    if GetResourceState('okokGarage') == 'started' then TriggerServerEvent('okokGarage:GiveKeys', plate) end
end
