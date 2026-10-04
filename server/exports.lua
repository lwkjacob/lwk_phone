-- Server exports for other resources. Names follow LB Phone's where the meaning is the same,
-- so scripts written against that phone need little changing.

--- The number of the phone a player has out, or nil.
exports('GetEquippedPhoneNumber', function(src)
    return Phone.number(src)
end)

--- The player holding a phone right now, or nil.
exports('GetSourceFromNumber', function(number)
    return Phone.source(Util.number(number) or '')
end)

exports('HasPhoneItem', function(src)
    return not Inv.required or #Inv.phones(src) > 0
end)

exports('IsInCall', function(src)
    local number = Phone.number(src)
    return number ~= nil and Calls.active(number) ~= nil
end)

--- target: a player source or a phone number. data: { app?, title, content }.
exports('SendNotification', function(target, data)
    if type(target) == 'string' then target = Util.number(target) or target end
    return Phone.notify(target, data.app or 'settings', data.title or '', data.content or '')
end)

--- A text from one number to another. `from` does not have to be a real phone ('Bank', '911').
exports('SendMessage', function(from, to, text)
    local body = Util.body({ text = text })
    local sender = Util.number(from) or Util.text(from, 1, 16)
    if not body or not sender then return false end
    return Messages.text(nil, sender, { to }, nil, body) ~= nil
end)

--- data: { to = 'name@domain', sender = 'Display Name', subject, message }.
exports('SendMail', function(data)
    return Social.mail(Util.text(data.sender, 1, 64) or 'System', data.to, Util.text(data.subject, 0, 120) or '', Util.text(data.message, 0, 4000) or '') ~= false
end)

--- A line in a phone's Wallet history (the money itself is yours to move).
exports('AddTransaction', function(number, amount, label)
    number = Util.number(number)
    if not number or type(amount) ~= 'number' then return false end
    Wallet.record(number, Util.text(label, 1, 60) or '', amount)
    local src = Phone.source(number)
    if src then Phone.patch(src, { wallet = Wallet.slice(src, number) }) end
    return true
end)

--- Ring a phone from a script. opts: { number, video?, hidden? }. Returns success.
exports('CreateCall', function(src, opts)
    local number = Phone.number(src)
    return number ~= nil and Calls.start(number, opts or {}) ~= nil
end)
