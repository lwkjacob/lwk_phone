-- Inventory bridge (server): the phone as an item.
--
-- Unique phones need an inventory that stores data on each item: ox_inventory or
-- qb-inventory. The phone's number is written onto the item, every bit of phone data is
-- keyed by that number, and so whoever holds the item holds the phone.
--
-- ox_inventory item (data/items.lua):
--   ['phone'] = { label = 'Phone', weight = 190, stack = false, consume = 0, client = { export = 'lwk_phone.usePhone' } },
-- qb-inventory item (qb-core/shared/items.lua): unique = true, useable = true, shouldClose = true.

Inv = {}

local function started(res) return GetResourceState(res) == 'started' or GetResourceState(res) == 'starting' end

local cfg = Config.item
local kind = cfg.inventory ~= 'auto' and cfg.inventory
    or (started('ox_inventory') and 'ox')
    or (started('qb-inventory') and 'qb')
    or 'none'
if Bridge.framework == 'standalone' then kind = 'none' end
Inv.kind = kind

local function auto(v) if v == 'auto' then return kind ~= 'none' end return v == true and kind ~= 'none' end
Inv.required = auto(cfg.require)
Inv.unique = Inv.required and auto(cfg.unique)

--- Every phone item `src` carries: { { slot = n, number = '555-0142' or nil } }.
function Inv.phones(src)
    local out = {}
    if kind == 'ox' then
        for _, s in pairs(exports.ox_inventory:Search(src, 'slots', cfg.name) or {}) do
            out[#out + 1] = { slot = s.slot, number = s.metadata and s.metadata.number }
        end
    elseif kind == 'qb' then
        for _, s in pairs(exports['qb-inventory']:GetItemsByName(src, cfg.name) or {}) do
            out[#out + 1] = { slot = s.slot, number = s.info and s.info.number }
        end
    end
    table.sort(out, function(a, b) return a.slot < b.slot end)
    return out
end

--- Write a number (and a readable label) onto a blank phone item. Returns success.
function Inv.stamp(src, slot, number, owner)
    local meta = { number = number, description = ('%s - %s'):format(number, owner or '') }
    if kind == 'ox' then
        exports.ox_inventory:SetMetadata(src, slot, meta)
        return true
    elseif kind == 'qb' then
        return exports['qb-inventory']:SetItemData(src, cfg.name, 'info', meta, slot) == true
    end
    return false
end

--- Calls fn(src, slot) when a player uses the phone item. ox_inventory instead calls the
--- client export named in the item definition (client.export = 'lwk_phone.usePhone').
function Inv.onUse(fn)
    if kind == 'qb' and started('qb-core') then
        exports['qb-core']:GetCoreObject().Functions.CreateUseableItem(cfg.name, function(src, item)
            fn(src, item and item.slot)
        end)
    end
end
