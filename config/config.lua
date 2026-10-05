-- LWK Phone configuration. Secrets (upload token, webhook) live in config/keys.lua, which only the server loads.

Config = {
    -- General -------------------------------------------------------------------
    locale    = 'en',          -- a file in config/locales/
    framework = 'auto',        -- auto | qbox | qb | esx | standalone
    bank      = 'auto',        -- company accounts: auto | lwk_bank | Renewed-Banking | qb-banking | okokBanking | qb-management | esx_addonaccount | none
    debug     = false,         -- prints every RPC to the server console

    -- Opening the phone -----------------------------------------------------------
    keybind = 'F1',            -- default only; players rebind it in the game's key settings
    command = 'phone',
    walk    = true,            -- keep moving while the phone is up (false = full cursor focus)
    cursorKey = 'LMENU',       -- hold the phone up but hand the mouse back to the game (aim the camera)

    -- The phone as an item ----------------------------------------------------------
    -- 'auto' turns both on when a framework AND an inventory with item metadata are running
    -- (ox_inventory, qb-inventory). Standalone servers always get one phone per player.
    item = {
        name      = 'phone',
        inventory = 'auto',    -- auto | ox | qb | none
        require   = 'auto',    -- the player must carry the item to open the phone
        unique    = 'auto',    -- each item is its own phone: number and data live on the item, so phones can be stolen
    },

    -- Phone numbers: <prefix> plus `digits` random digits, shown as 555-0142 -------------
    numbers = { prefixes = { '555' }, digits = 4 },

    -- Calls ---------------------------------------------------------------------------
    calls = {
        ringSeconds = 30,      -- unanswered calls become missed calls after this
        voice       = 'auto',  -- auto | pma | none   (none = calls connect but carry no audio)
    },

    -- Video and live streams travel player-to-player over WebRTC. Direct routes often fail
    -- across home networks, so add a TURN server here for reliable video.
    rtc = { iceServers = { { urls = 'stun:stun.l.google.com:19302' } } },

    -- Photo, video and audio hosting ------------------------------------------------------
    upload = { provider = 'fivemanage' },   -- token goes in config/keys.lua; '' there disables capture

    -- Maps ----------------------------------------------------------------------------------
    -- `image` is a URL to one picture of the whole map covering `bounds` (game coordinates).
    -- Left empty, Maps draws a plain placeholder but still shows real positions and waypoints.
    map = {
        image  = '',
        bounds = { minX = -4000.0, maxX = 4500.0, minY = -4000.0, maxY = 8000.0 },
    },
    places = {
        { name = 'Legion Square',      kind = 'Landmark',   x = 195.0,   y = -934.0 },
        { name = 'Del Perro Pier',     kind = 'Attraction', x = -1850.0, y = -1230.0 },
        { name = 'Pillbox Medical',    kind = 'Hospital',   x = 300.0,   y = -585.0 },
        { name = 'Mission Row PD',     kind = 'Police',     x = 428.9,   y = -984.5 },
        { name = 'Vinewood Sign',      kind = 'Landmark',   x = 711.0,   y = 1198.0 },
        { name = 'LS International',   kind = 'Airport',    x = -1037.0, y = -2737.0 },
    },

    -- Services: companies players can call or message. `job` is the framework job name. --------
    -- icon: police | ambulance | mechanic | taxi | realestate | lawyer
    companies = {
        { job = 'police',    name = 'Police',    desc = 'Los Santos Police Department', color = '#0a84ff', icon = 'police' },
        { job = 'ambulance', name = 'Ambulance', desc = 'Emergency Medical Services',   color = '#ff3b30', icon = 'ambulance' },
        { job = 'mechanic',  name = 'Mechanic',  desc = 'Repairs and towing',           color = '#ff9500', icon = 'mechanic' },
        { job = 'taxi',      name = 'Taxi',      desc = 'Downtown Cab Co.',             color = '#ffcc00', icon = 'taxi' },
    },

    -- Garage -------------------------------------------------------------------------------------
    -- fromImpound = false: impounded vehicles cannot be released from the phone and have to be collected.
    garage = { valetFee = 100, impoundFee = 250, fromImpound = true },

    -- Music: no songs ship with the phone. Add your own (direct links to audio files). -------------
    -- The Music app is hidden while this list is empty.
    -- { title = 'Night Shift', artist = 'Vespucci Drive', album = 'Coastlines', url = 'https://...', cover = 'https://...', seconds = 214 }
    music = {},

    -- Crypto: made-up coins whose prices drift on their own. Bought and sold with bank money. --------
    crypto = {
        enabled = true,
        tickSeconds = 60,
        coins = {
            { id = 'LSC', name = 'Santos Coin', price = 41820.5, color = '#f7931a' },
            { id = 'VNW', name = 'Vinewood',    price = 2210.18, color = '#627eea' },
            { id = 'PLT', name = 'Paleto',      price = 96.42,   color = '#14f195' },
            { id = 'CHP', name = 'ChopCoin',    price = 0.0841,  color = '#c2a633' },
            { id = 'MZE', name = 'Maze',        price = 13.07,   color = '#e84142' },
        },
    },

    mailDomain = 'lsmail.net',
    airShareRange = 8.0,       -- metres

    -- The phone in the player's hand -------------------------------------------------------------
    prop = { model = 'prop_npc_phone_02', bone = 28422 },
    anim = {
        dict = 'cellphone@',            carDict = 'cellphone@in_car@ds',
        open = 'cellphone_text_in',     idle = 'cellphone_text_read_base',
        call = 'cellphone_call_listen_base', close = 'cellphone_text_out',
    },

    -- Admins (delete any post, /phoneverify, /phonepassword) ------------------------------------------
    adminAce = 'lwk_phone.admin',
}
