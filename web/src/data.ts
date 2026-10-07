/* Mock world for browser testing. In-game this all comes from Lua; the shapes here are the contract. */

const now = Date.now();
const m = 60_000;
const h = 60 * m;
const d = 24 * h;

/** A picture: a number is a generated placeholder (browser demo), a string is the URL of an uploaded image. */
export type Seed = number | string;

export const me = { name: 'Marcus Reyes', number: '555-0199', handle: 'marcus', email: 'marcus@lsmail.net' };

export type Contact = { id: number; name: string; number: string; fav?: boolean; blocked?: boolean; email?: string };
export const contacts: Contact[] = [
  { id: 1, name: 'Ava Castillo', number: '555-0142', fav: true, email: 'ava@lsmail.net' },
  { id: 2, name: 'Benny Okafor', number: '555-0117', fav: true },
  { id: 3, name: 'Carmen Diaz', number: '555-0163' },
  { id: 4, name: 'Dex Holloway', number: '555-0188', fav: true },
  { id: 5, name: 'Elena Park', number: '555-0125' },
  { id: 6, name: 'Frankie Moretti', number: '555-0171' },
  { id: 7, name: 'Gia Thompson', number: '555-0109' },
  { id: 8, name: 'Hank Weller', number: '555-0134' },
  { id: 9, name: 'Imani Brooks', number: '555-0156' },
  { id: 10, name: 'Jules Mercer', number: '555-0190' },
  { id: 11, name: 'Mom', number: '555-0101', fav: true },
  { id: 12, name: 'Tow Yard', number: '555-0147' },
];

export type CallLog = { id: number; number: string; dir: 'in' | 'out' | 'missed'; time: number; video?: boolean; dur?: number };
export const calls: CallLog[] = [
  { id: 1, number: '555-0142', dir: 'in', time: now - 22 * m, dur: 184 },
  { id: 2, number: '555-0173', dir: 'missed', time: now - 2 * h },
  { id: 3, number: '555-0117', dir: 'out', time: now - 5 * h, dur: 62 },
  { id: 4, number: '555-0101', dir: 'missed', time: now - d },
  { id: 5, number: '555-0188', dir: 'out', time: now - d - 3 * h, video: true, dur: 431 },
  { id: 6, number: '555-0125', dir: 'in', time: now - 2 * d, dur: 45 },
  { id: 7, number: '555-0142', dir: 'out', time: now - 3 * d, dur: 912 },
];

export type Voicemail = { id: number; number: string; time: number; dur: number; heard?: boolean; /** The demo's transcript. */ text?: string; /** In-game: the recording. */ audio?: string };
export const voicemail: Voicemail[] = [
  { id: 1, number: '555-0101', time: now - d, dur: 24, text: 'Hi sweetheart, call me back when you get a minute. Nothing urgent.' },
  { id: 2, number: '555-0147', time: now - 4 * d, dur: 41, heard: true, text: 'This is the tow yard. Your vehicle is ready for pickup, fee is two fifty.' },
];

export type Msg = { id: number; me?: boolean; from?: string; text?: string; pic?: Seed; loc?: string; money?: number; voice?: number; x?: number; y?: number; time: number; failed?: boolean; /** Recorded audio for a voice message. */ audio?: string };
export type Chat = { id: number; /** Server channel id, once the conversation exists there. */ ch?: number; numbers: string[]; name?: string; msgs: Msg[]; unread: number; muted?: boolean };
export const chats: Chat[] = [
  {
    id: 1, numbers: ['555-0142'], unread: 2,
    msgs: [
      { id: 1, text: 'You still coming to the pier tonight?', time: now - 3 * h },
      { id: 2, me: true, text: 'Yeah, finishing a job first. 9?', time: now - 3 * h + 2 * m },
      { id: 3, text: 'Perfect. Look what I found btw', time: now - 2 * h },
      { id: 4, pic: 7, time: now - 2 * h + m },
      { id: 5, me: true, text: 'No way. Where is that?', time: now - 2 * h + 4 * m },
      { id: 6, loc: 'Del Perro Pier', time: now - 25 * m },
      { id: 7, text: 'Bring cash, the good stalls don’t take card', time: now - 24 * m },
    ],
  },
  {
    id: 2, numbers: ['555-0188', '555-0117', '555-0109'], name: 'Friday Crew', unread: 0,
    msgs: [
      { id: 1, from: '555-0188', text: 'Who’s driving?', time: now - 6 * h },
      { id: 2, from: '555-0117', text: 'Not me, mine’s on the lift', time: now - 6 * h + m },
      { id: 3, me: true, text: 'I’ll drive. Be outside at 8.', time: now - 6 * h + 3 * m },
      { id: 4, from: '555-0109', text: 'Told you so', time: now - 5 * h },
      { id: 5, from: '555-0188', text: 'Legend', time: now - 5 * h + m },
    ],
  },
  {
    id: 3, numbers: ['555-0117'], unread: 0,
    msgs: [
      { id: 1, text: 'Brakes are done. Comes to $320 with parts.', time: now - d },
      { id: 2, me: true, money: 320, time: now - d + 5 * m },
      { id: 3, text: 'Got it, cheers. Keys are at the front desk.', time: now - d + 6 * m },
      { id: 4, voice: 9, time: now - d + 8 * m },
    ],
  },
  {
    id: 4, numbers: ['555-0101'], unread: 0,
    msgs: [
      { id: 1, text: 'Are you eating properly?', time: now - 2 * d },
      { id: 2, me: true, text: 'Yes mom', time: now - 2 * d + 30 * m },
      { id: 3, text: 'Call me Sunday ❤️', time: now - 2 * d + 31 * m },
    ],
  },
  {
    id: 5, numbers: ['555-0173'], unread: 1,
    msgs: [{ id: 1, text: 'Is the Sultan still for sale? Saw your ad.', time: now - 2 * h }],
  },
];
export const replies = ['Sounds good', 'On my way', 'Haha no chance', 'Give me 10 minutes', 'Call me', 'Deal.', 'Where are you?', '👍'];

export type Photo = { id: number; seed: Seed; /** Video file, when this is a video; `seed` is then its poster frame. */ src?: string; time: number; fav?: boolean; video?: number; selfie?: boolean };
export const photos: Photo[] = [
  { id: 1, seed: 7, time: now - 2 * h, fav: true },
  { id: 2, seed: 12, time: now - 5 * h },
  { id: 3, seed: 3, time: now - d, video: 14 },
  { id: 4, seed: 21, time: now - d - 2 * h, selfie: true },
  { id: 5, seed: 30, time: now - 2 * d },
  { id: 6, seed: 16, time: now - 2 * d - h, fav: true },
  { id: 7, seed: 44, time: now - 3 * d },
  { id: 8, seed: 9, time: now - 4 * d, video: 32 },
  { id: 9, seed: 27, time: now - 5 * d },
  { id: 10, seed: 38, time: now - 6 * d, selfie: true },
  { id: 11, seed: 52, time: now - 8 * d },
  { id: 12, seed: 61, time: now - 9 * d },
  { id: 13, seed: 5, time: now - 12 * d, fav: true },
  { id: 14, seed: 70, time: now - 15 * d },
];

export type Note = { id: number; title: string; body: string; time: number };
export const notes: Note[] = [
  { id: 1, title: 'Garage codes', body: 'Vinewood unit: 4471\nPaleto storage: ask Hank\n\nDon’t text these to anyone.', time: now - 3 * h },
  { id: 2, title: 'Shopping', body: 'Repair kit x2\nWater\nPhone charger\nNew plates', time: now - d },
  { id: 3, title: 'Job ideas', body: 'Tow contracts pay better on weekends.\nAsk Frankie about the delivery route.', time: now - 6 * d },
];

export type Mail = { id: number; from: string; addr: string; subject: string; body: string; time: number; read?: boolean; sent?: boolean };
export const mail: Mail[] = [
  { id: 1, from: 'Los Santos DMV', addr: 'noreply@lsdmv.gov', subject: 'Registration renewal due', body: 'Your vehicle registration for plate 48KZP212 expires in 14 days.\n\nRenew online or at any DMV office to avoid a late fee.', time: now - 40 * m },
  { id: 2, from: 'Premium Deluxe Motorsport', addr: 'sales@pdm.ls', subject: 'Your test drive is confirmed', body: 'Hi Marcus,\n\nWe have you booked for Saturday at 2:00 PM. Bring a valid licence.\n\nSee you then,\nSimeon', time: now - 4 * h },
  { id: 3, from: 'LWK Bank', addr: 'statements@lwkbank.com', subject: 'Your monthly statement is ready', body: 'Your statement for last month is now available in the Wallet app.\n\nClosing balance: $12,480.55', time: now - d, read: true },
  { id: 4, from: 'Ava Castillo', addr: 'ava@lsmail.net', subject: 'Photos from the weekend', body: 'Finally sorted through them. The one of you falling off the jetski is my new wallpaper.', time: now - 3 * d, read: true },
  { id: 5, from: 'Weazel News', addr: 'daily@weazel.news', subject: 'Morning briefing', body: 'Traffic chaos on the Del Perro Freeway, a new mayor in Paleto Bay, and why everyone is suddenly buying boats.', time: now - 4 * d, read: true },
];

export type Alarm = { id: number; time: string; label: string; on: boolean; days: string };
export const alarms: Alarm[] = [
  { id: 1, time: '07:00', label: 'Shift', on: true, days: 'Weekdays' },
  { id: 2, time: '09:30', label: 'Alarm', on: false, days: 'Never' },
  { id: 3, time: '22:15', label: 'Night run', on: true, days: 'Fri Sat' },
];
export const worldClocks = [
  { city: 'Los Santos', offset: -7 },
  { city: 'Liberty City', offset: -4 },
  { city: 'London', offset: 1 },
  { city: 'Tokyo', offset: 9 },
];

export type Memo = { id: number; name: string; time: number; dur: number; /** The recording, when one was captured. */ url?: string };
export const memos: Memo[] = [
  { id: 1, name: 'Meeting with Frankie', time: now - d, dur: 73 },
  { id: 2, name: 'Vinewood Blvd', time: now - 5 * d, dur: 18 },
];

export const weather = {
  city: 'Los Santos', temp: 24, cond: 'Mostly Sunny', hi: 27, lo: 16,
  hourly: [['Now', 'sun', 24], ['1PM', 'sun', 25], ['2PM', 'sun', 27], ['3PM', 'cloudsun', 26], ['4PM', 'cloudsun', 25], ['5PM', 'cloud', 23], ['6PM', 'cloud', 21], ['7PM', 'rain', 19], ['8PM', 'rain', 18], ['9PM', 'moon', 17]] as [string, string, number][],
  daily: [['Today', 'sun', 16, 27], ['Tue', 'cloudsun', 15, 25], ['Wed', 'rain', 13, 19], ['Thu', 'rain', 12, 18], ['Fri', 'cloud', 14, 22], ['Sat', 'sun', 16, 28], ['Sun', 'sun', 17, 29]] as [string, string, number, number][],
  wind: 11, humidity: 48, uv: 6, feels: 25, visibility: 16, sunset: '7:42 PM',
};

export type Place = { id: number; name: string; kind: string; /** Game coordinates. */ x: number; y: number };
export const places: Place[] = [
  { id: 1, name: 'Legion Square', kind: 'Landmark', x: 195, y: -934 },
  { id: 2, name: 'Del Perro Pier', kind: 'Attraction', x: -1850, y: -1230 },
  { id: 3, name: 'Benny’s Motorworks', kind: 'Mechanic', x: -205, y: -1310 },
  { id: 4, name: 'Pillbox Medical', kind: 'Hospital', x: 300, y: -585 },
  { id: 5, name: 'Mission Row PD', kind: 'Police', x: 428.9, y: -984.5 },
  { id: 6, name: 'Vinewood Sign', kind: 'Landmark', x: 711, y: 1198 },
  { id: 7, name: 'LS International', kind: 'Airport', x: -1037, y: -2737 },
];

export type Tx = { id: number; label: string; amount: number; time: number };
export const wallet = {
  balance: 12480.55, cash: 640, iban: 'LW204118',
  txs: [
    { id: 1, label: 'Benny Okafor', amount: -320, time: now - d },
    { id: 2, label: 'Paycheck · LS Customs', amount: 1850, time: now - 2 * d },
    { id: 3, label: '24/7 Supermarket', amount: -42.8, time: now - 2 * d - 3 * h },
    { id: 4, label: 'Ava Castillo', amount: 75, time: now - 4 * d },
    { id: 5, label: 'Xero Gas', amount: -61.2, time: now - 5 * d },
    { id: 6, label: 'Rent · Vinewood Apt 12', amount: -900, time: now - 7 * d },
  ] as Tx[],
};

/**
 * In-game what a house can do depends on the housing script: `locked` is missing when it has no door control,
 * `keys` when it has no key list, and `way` is set when only the script itself knows where the house is.
 * A key holder is a character (`id` is what the script calls them); in the demo it is a phone number.
 */
export type House = { id: number | string; name: string; addr?: string; locked?: boolean; lights?: boolean; keys?: { id: string; name: string }[]; seed?: Seed; x?: number; y?: number; way?: boolean };
export const houses: House[] = [
  { id: 1, name: 'Vinewood Apartment', addr: '12 Eclipse Blvd', locked: true, lights: false, keys: [{ id: '555-0142', name: '' }], seed: 33 },
  { id: 2, name: 'Paleto Cabin', addr: '4 Procopio Dr', locked: false, lights: true, keys: [], seed: 58 },
];

export type Vehicle = { id: number; name: string; plate: string; state: 'out' | 'garaged' | 'impound'; garage: string; fuel: number; engine: number; body: number; color: string };
export const vehicles: Vehicle[] = [
  { id: 1, name: 'Karin Sultan RS', plate: '48KZP212', state: 'out', garage: 'Legion Square', fuel: 62, engine: 91, body: 78, color: '#2a6df4' },
  { id: 2, name: 'Bravado Buffalo', plate: '07LSM903', state: 'garaged', garage: 'Pillbox Garage', fuel: 100, engine: 100, body: 100, color: '#1c1c1e' },
  { id: 3, name: 'Vapid Sandking', plate: '63PAL118', state: 'garaged', garage: 'Paleto Bay', fuel: 34, engine: 72, body: 66, color: '#c4521b' },
  { id: 4, name: 'Pegassi Bati 801', plate: '21BKR450', state: 'impound', garage: 'Davis Impound', fuel: 12, engine: 48, body: 40, color: '#d0d0d4' },
];

export type Service = { id: string; icon?: string; name: string; desc: string; color: string; online: number; open: boolean; number: string };
export const services: Service[] = [
  { id: 'police', name: 'Police', desc: 'Los Santos Police Department', color: '#0a84ff', online: 8, open: true, number: '911' },
  { id: 'ambulance', name: 'Ambulance', desc: 'Emergency Medical Services', color: '#ff3b30', online: 5, open: true, number: '912' },
  { id: 'mechanic', name: 'Mechanic', desc: 'LS Customs · Repairs and towing', color: '#ff9500', online: 3, open: true, number: '555-0117' },
  { id: 'taxi', name: 'Taxi', desc: 'Downtown Cab Co.', color: '#ffcc00', online: 2, open: true, number: '555-0122' },
  { id: 'realestate', name: 'Real Estate', desc: 'Dynasty 8', color: '#34c759', online: 0, open: false, number: '555-0180' },
  { id: 'lawyer', name: 'Lawyer', desc: 'Legal counsel', color: '#af52de', online: 1, open: true, number: '555-0166' },
];
export type Job = {
  company: string; label?: string; grade: string; duty?: boolean; balance?: number; boss: boolean;
  /** In-game, for a boss: their own grade as a number, and every grade of the job, lowest first. */
  level?: number; grades?: { level: number; name: string }[];
  staff: { id?: string; name: string; grade: string; level?: number; online: boolean }[];
};
export const job: Job = {
  company: 'mechanic', grade: 'Manager', duty: true, balance: 48200, boss: true,
  staff: [
    { name: 'Benny Okafor', grade: 'Owner', online: true },
    { name: 'Marcus Reyes', grade: 'Manager', online: true },
    { name: 'Gia Thompson', grade: 'Mechanic', online: true },
    { name: 'Hank Weller', grade: 'Trainee', online: false },
  ],
};

export type Song = { id: number; title: string; artist: string; album: string; dur: number; seed: Seed; url?: string };
export const songs: Song[] = [
  { id: 1, title: 'Night Shift', artist: 'Vespucci Drive', album: 'Coastlines', dur: 214, seed: 11 },
  { id: 2, title: 'Neon Tide', artist: 'Vespucci Drive', album: 'Coastlines', dur: 187, seed: 11 },
  { id: 3, title: 'Low Rider Lullaby', artist: 'Strawberry Ave', album: 'East Side', dur: 242, seed: 26 },
  { id: 4, title: 'Blaine County Line', artist: 'The Sandy Shores', album: 'Dust', dur: 201, seed: 41 },
  { id: 5, title: 'Mirror Park', artist: 'Aly Nova', album: 'Slow Motion', dur: 229, seed: 55 },
  { id: 6, title: 'Rooftops', artist: 'Aly Nova', album: 'Slow Motion', dur: 176, seed: 55 },
  { id: 7, title: 'Pacific Standard', artist: 'KLOUD', album: 'Vaults', dur: 258, seed: 68 },
  { id: 8, title: 'Sunset Radio', artist: 'Strawberry Ave', album: 'East Side', dur: 195, seed: 26 },
];
export const playlists = [
  { id: 1, name: 'Late Drives', songs: [1, 2, 7, 5], seed: 14 },
  { id: 2, name: 'Workshop', songs: [3, 4, 8], seed: 47 },
];

/* ---------- social ---------- */

export type User = { name: string; bio: string; verified?: boolean; followers: number; following: number; followed?: boolean };
export const users: Record<string, User> = {
  marcus: { name: 'Marcus Reyes', bio: 'Mechanic. Night driver. Los Santos.', followers: 214, following: 180 },
  ava: { name: 'Ava Castillo', bio: 'Photographer · Del Perro', followers: 5321, following: 412, followed: true },
  weazel: { name: 'Weazel News', bio: 'Confirming your prejudices since 1998.', verified: true, followers: 182_400, following: 12, followed: true },
  dex: { name: 'Dex Holloway', bio: 'I fix it, you break it.', followers: 890, following: 301, followed: true },
  lspd: { name: 'LSPD', bio: 'Official account of the Los Santos Police Department.', verified: true, followers: 96_200, following: 3 },
  gia: { name: 'Gia Thompson', bio: 'Tuner · track days · coffee', followers: 2104, following: 598, followed: true },
  bean: { name: 'Bean Machine', bio: 'Coffee. Loudly.', verified: true, followers: 44_800, following: 51 },
  jules: { name: 'Jules Mercer', bio: 'Real estate, Dynasty 8', followers: 1320, following: 760 },
};

export type Post = { id: number; user: string; text: string; time: number; likes: number; liked?: boolean; reposts: number; reposted?: boolean; pic?: Seed; replies: { user: string; text: string }[]; /** In-game, on your own posts: who liked it. */ likers?: string[] };
export const flock: Post[] = [
  { id: 1, user: 'weazel', text: 'BREAKING: Traffic on the Del Perro Freeway is at a standstill after a truck spilled 4,000 oranges. Avoid the area. #LSTraffic', time: now - 12 * m, likes: 1204, reposts: 388, pic: 19, replies: [{ user: 'dex', text: 'Free juice' }, { user: 'gia', text: 'I was late anyway' }] },
  { id: 2, user: 'ava', text: 'Golden hour at the pier never misses.', time: now - 50 * m, likes: 312, liked: true, reposts: 21, pic: 7, replies: [{ user: 'marcus', text: 'Unreal' }] },
  { id: 3, user: 'lspd', text: 'Reminder: street racing is illegal, even if you are very good at it. #DriveSafe', time: now - 2 * h, likes: 2841, reposts: 902, replies: [{ user: 'gia', text: 'Noted' }] },
  { id: 4, user: 'dex', text: 'Somebody explain why every customer says "it just started making that noise" about a car with no oil in it', time: now - 4 * h, likes: 96, reposts: 8, replies: [] },
  { id: 5, user: 'bean', text: 'New: the Quadruple Shot. Please consult a doctor. #BeanMachine', time: now - 7 * h, likes: 540, reposts: 77, pic: 36, replies: [] },
  { id: 6, user: 'gia', text: 'Track day Saturday at the airfield. Bring a helmet and low expectations. #LSCarMeet', time: now - d, likes: 201, reposts: 34, replies: [{ user: 'marcus', text: 'I’m in' }] },
  { id: 7, user: 'marcus', text: 'Finally got the Sultan back on the road.', time: now - 2 * d, likes: 41, reposts: 2, pic: 44, replies: [{ user: 'ava', text: 'About time!' }] },
];
export const trends = [['#LSTraffic', '12.4K'], ['#LSCarMeet', '4,210'], ['#BeanMachine', '2,960'], ['#DriveSafe', '1,877'], ['#PaletoBay', '964']];

export type Gram = { id: number; user: string; seed: Seed; caption: string; time: number; likes: number; liked?: boolean; saved?: boolean; comments: { user: string; text: string }[] };
export const lumen: Gram[] = [
  { id: 1, user: 'ava', seed: 7, caption: 'Pier lights', time: now - h, likes: 842, comments: [{ user: 'gia', text: 'Stunning' }, { user: 'marcus', text: 'Teach me' }] },
  { id: 2, user: 'gia', seed: 23, caption: 'New wheels day', time: now - 5 * h, likes: 311, liked: true, comments: [{ user: 'dex', text: 'Offset?' }] },
  { id: 3, user: 'bean', seed: 36, caption: 'Open late all week.', time: now - d, likes: 1290, comments: [] },
  { id: 4, user: 'dex', seed: 49, caption: 'Before / after. You’re welcome.', time: now - 2 * d, likes: 157, comments: [{ user: 'ava', text: 'Night and day' }] },
  { id: 5, user: 'marcus', seed: 44, caption: 'Back on the road', time: now - 2 * d, likes: 88, comments: [] },
  { id: 6, user: 'marcus', seed: 12, caption: 'Mount Chiliad at 6am', time: now - 9 * d, likes: 132, comments: [] },
  { id: 7, user: 'jules', seed: 64, caption: 'Just listed: 3 bed in Rockford Hills.', time: now - 3 * d, likes: 62, comments: [] },
];
export type Story = { user: string; seeds: Seed[]; seen: boolean; live?: boolean };
export const stories: Story[] = [
  { user: 'ava', seeds: [8, 15], seen: false, live: true },
  { user: 'gia', seeds: [24], seen: false },
  { user: 'dex', seeds: [50, 51, 53], seen: false },
  { user: 'bean', seeds: [37], seen: true },
  { user: 'jules', seeds: [65], seen: true },
];

export type Thread = { id: number; user: string; msgs: Msg[] };
export const dms: Record<'flock' | 'lumen', Thread[]> = {
  flock: [
    { id: 1, user: 'gia', msgs: [{ id: 1, text: 'You coming Saturday? Need a headcount', time: now - 3 * h }] },
    { id: 2, user: 'dex', msgs: [{ id: 1, me: true, text: 'Got a 10mm I can borrow?', time: now - d }, { id: 2, text: 'I have never owned a 10mm for longer than a day', time: now - d + 4 * m }] },
  ],
  lumen: [{ id: 1, user: 'ava', msgs: [{ id: 1, text: 'Sent you the full-res ones', time: now - 5 * h }, { id: 2, pic: 15, time: now - 5 * h + m }] }],
};

export type Clip ={ id: number; user: string; seed: Seed; src?: string; caption: string; sound: string; likes: number; liked?: boolean; saved?: boolean; comments: { user: string; text: string }[]; shares: number };
export const loop: Clip[] = [
  { id: 1, user: 'gia', seed: 23, caption: 'POV: the turbo finally spools #LSCarMeet', sound: 'Night Shift · Vespucci Drive', likes: 48_200, comments: [{ user: 'dex', text: 'That sound though' }, { user: 'ava', text: 'I can hear this video' }], shares: 912 },
  { id: 2, user: 'ava', seed: 8, caption: 'Sunrise from Mount Chiliad, worth the hike', sound: 'Mirror Park · Aly Nova', likes: 12_900, liked: true, comments: [{ user: 'marcus', text: 'Take me next time' }], shares: 240 },
  { id: 3, user: 'bean', seed: 37, caption: 'How we make the Quadruple Shot ☕', sound: 'original sound · Bean Machine', likes: 301_000, comments: [], shares: 8800 },
  { id: 4, user: 'dex', seed: 50, caption: 'Customer states: "it makes a noise"', sound: 'original sound · dex', likes: 7400, comments: [{ user: 'gia', text: 'Every. Single. Day.' }], shares: 133 },
  { id: 5, user: 'weazel', seed: 19, caption: '4,000 oranges. One freeway. #LSTraffic', sound: 'Weazel News', likes: 96_500, comments: [], shares: 5100 },
];

export type Spark = { id: number; /** Server-side handle for swipes and chats. */ key?: string; name: string; age: number; bio: string; job: string; dist: number; seeds: Seed[]; likesYou?: boolean };
export const ember: Spark[] = [
  { id: 1, name: 'Nora', age: 27, bio: 'Paramedic. Will absolutely judge your driving.', job: 'EMS', dist: 2, seeds: [72, 73], likesYou: true },
  { id: 2, name: 'Tasha', age: 25, bio: 'Looking for someone to split a boat with.', job: 'Bartender', dist: 5, seeds: [81, 82] },
  { id: 3, name: 'Riley', age: 29, bio: 'Hikes, tacos, terrible puns.', job: 'Pilot', dist: 11, seeds: [90], likesYou: true },
  { id: 4, name: 'Sam', age: 31, bio: 'Lawyer by day. Still a lawyer at night, sadly.', job: 'Lawyer', dist: 3, seeds: [97, 98] },
  { id: 5, name: 'Mika', age: 24, bio: 'I own four cars and no furniture.', job: 'Tuner', dist: 8, seeds: [105] },
];
export type Match = { id: number; key?: string; name: string; seed: Seed; msgs: Msg[] };
export const matches: Match[] = [
  { id: 101, name: 'Lena', seed: 113, msgs: [{ id: 1, text: 'So is that your Sultan in the second photo?', time: now - 3 * h }] as Msg[] },
  { id: 102, name: 'Priya', seed: 120, msgs: [] as Msg[] },
];

export const shade = {
  alias: 'ghost_4471',
  channels: [
    { id: 1, name: 'general', members: 142, msgs: [{ id: 1, from: 'anon_882', text: 'anyone know who runs the docks now', time: now - 40 * m }, { id: 2, from: 'vx', text: 'not over this channel', time: now - 38 * m }] as Msg[] },
    { id: 2, name: 'trade', members: 67, msgs: [{ id: 1, from: 'needle', text: 'WTS: clean plates, 3 sets', time: now - 2 * h }] as Msg[] },
    { id: 3, name: 'drivers', members: 31, msgs: [] as Msg[] },
  ],
};

export type Ad = { id: number; title: string; body: string; number: string; time: number; price?: number; seed?: Seed; mine?: boolean };
export const adverts: Ad[] = [
  { id: 1, title: 'Tow driver wanted', body: 'Weekends, paid per job. Own licence required. Call Benny.', number: '555-0117', time: now - 2 * h },
  { id: 2, title: 'Lost dog near Mirror Park', body: 'Brown lab, answers to Chop. Reward offered.', number: '555-0156', time: now - 6 * h, seed: 77 },
  { id: 3, title: 'Private security, any event', body: 'Licensed and discreet. Hourly rates.', number: '555-0134', time: now - d },
  { id: 4, title: 'Room to rent, Vespucci', body: 'Ocean view if you lean out the window. $600/mo.', number: '555-0190', time: now - 3 * d, seed: 84 },
];
export const market: Ad[] = [
  { id: 1, title: 'Karin Sultan RS', body: 'Stage 2, fresh brakes, 48k miles. No lowballers.', number: '555-0199', time: now - 3 * h, price: 42000, seed: 44, mine: true },
  { id: 2, title: 'Mountain bike', body: 'Barely used. Helmet included.', number: '555-0109', time: now - 8 * h, price: 350, seed: 91 },
  { id: 3, title: 'Leather sofa', body: 'Collection only, Rockford Hills.', number: '555-0190', time: now - d, price: 800, seed: 102 },
  { id: 4, title: 'Vintage radio', body: 'Works. Mostly.', number: '555-0171', time: now - 2 * d, price: 120, seed: 108 },
  { id: 5, title: 'Jet ski', body: 'One careful owner, one careless one.', number: '555-0142', time: now - 4 * d, price: 6500, seed: 116 },
];

export type Coin = { id: string; name: string; price: number; change: number; owned: number; color: string; hist: number[] };
const hist = (seed: number, drift: number) => Array.from({ length: 32 }, (_, i) => 50 + Math.sin(i * 0.7 + seed) * 14 + Math.sin(i * 0.23 + seed * 2) * 10 + i * drift);
export const coins: Coin[] = [
  { id: 'LSC', name: 'Santos Coin', price: 41820.5, change: 2.4, owned: 0.12, color: '#f7931a', hist: hist(1, 0.6) },
  { id: 'VNW', name: 'Vinewood', price: 2210.18, change: -1.1, owned: 1.5, color: '#627eea', hist: hist(2, -0.3) },
  { id: 'PLT', name: 'Paleto', price: 96.42, change: 5.8, owned: 0, color: '#14f195', hist: hist(3, 0.9) },
  { id: 'CHP', name: 'ChopCoin', price: 0.0841, change: -7.3, owned: 12000, color: '#c2a633', hist: hist(4, -0.7) },
  { id: 'MZE', name: 'Maze', price: 13.07, change: 0.6, owned: 40, color: '#e84142', hist: hist(5, 0.1) },
];

export const nearby = ['Ava Castillo', 'Dex Holloway', 'Unknown player'];
