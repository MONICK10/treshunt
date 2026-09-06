// Bible-themed clues for each campus location.
// `id` is what gets encoded in that location's QR code (as ?loc=ID).
// `riddle` is shown to a team BEFORE they've found the place — it never
// names the location outright (except CS_DEPT, the known assembly point).
//
// GAME SHAPE: every team's route is
//   CS_DEPT (start) -> all 11 POOL locations, shuffled -> CS_DEPT (finish)
// There are only 5 distinct shuffles; teams are assigned one by cycling
// through them in team-number order (see seed.js).
// Winner = fastest total time between their first and second CS_DEPT scan.

const CS_DEPT = {
  id: "CS_DEPT",
  name: "CS Department",
  // Shown before the team has scanned CS Dept for the first time.
  startText:
    "Every race has a beginning. Yours starts right here. Scan the QR code at the CS Department to start your clock and receive your very first clue.",
  startVerse: "“Let us run with endurance the race that is set before us.” — Hebrews 12:1",
  // Shown after all stops are done, telling them to come back.
  finishText:
    "Eleven places found, eleven stories walked — now only one place remains: the place where it all began. Return to the CS Department and scan to finish the race.",
  finishVerse: "“I have fought the good fight, I have finished the race, I have kept the faith.” — 2 Timothy 4:7",
};

const POOL = [
  {
    id: "CANTEEN",
    name: "Canteen",
    riddle:
      "Five loaves, two fish, a hillside crowd of thousands — yet none went home hungry, and baskets of leftovers remained. Find the place on campus where hunger is answered every single day.",
    verse: "“They all ate and were satisfied, and the disciples picked up twelve baskets full.” — Matthew 14:20",
  },
  {
    id: "EMMANUEL_AUDI",
    name: "Emmanuel Auditorium",
    riddle:
      "\"His name shall be called Emmanuel\" — which means, God with us. Where the whole assembly gathers as one, in song and one accord, find the hall that carries His name.",
    verse: "“They shall call his name Immanuel, which means, God with us.” — Matthew 1:23",
  },
  {
    id: "MECH",
    name: "Mechanical Department",
    riddle:
      "Tubal-Cain was the forger of every tool of bronze and iron. And as iron sharpens iron, so one craftsman sharpens another. Find where metal, machines, and minds are shaped together.",
    verse: "“As iron sharpens iron, so one person sharpens another.” — Proverbs 27:17",
  },
  {
    id: "CIVIL",
    name: "Civil Department",
    riddle:
      "Joseph, husband of Mary, earned his bread shaping wood and stone — a carpenter by trade. Find the department where today's builders learn to shape beams, stone, and cities.",
    verse: "“Is not this the carpenter's son?” — Matthew 13:55",
  },
  {
    id: "CHANDRAN",
    name: "Chandran Stores",
    riddle:
      "He drove out those who bought and sold, overturning the tables of the money-changers, saying His house should be a house of prayer, not a den of robbers. Find today's marketplace on campus, where buying and selling still happen.",
    verse: "“My house shall be called a house of prayer, but you have made it a den of robbers.” — Matthew 21:13",
  },
  {
    id: "AGRI",
    name: "Agriculture Department",
    riddle:
      "A sower went out to sow. Some seed fell on the path, some on rocky ground, some among thorns — but some fell on good soil and yielded a hundredfold. Find where seeds are still sown and soil still matters.",
    verse: "“Other seed fell on good soil and produced a crop — a hundred, sixty or thirty times what was sown.” — Matthew 13:8",
  },
  {
    id: "MEDIA",
    name: "Media Department",
    riddle:
      "\"Go into all the world and preach the gospel to every creature\" — a message meant to be carried far, told and retold, filmed and broadcast. Find the department where stories are recorded and sent out to everyone.",
    verse: "“Go into all the world and preach the gospel to all creation.” — Mark 16:15",
  },
  {
    id: "LIBRARY",
    name: "Central Library",
    riddle:
      "In the beginning was the Word, and the Word was with God. Long before screens, His words were copied by hand and kept on scrolls. Find the quiet hall where words still live on shelves.",
    verse: "“In the beginning was the Word, and the Word was with God.” — John 1:1",
  },
  {
    id: "CTC1",
    name: "Computer Technology Center 1",
    riddle:
      "A mysterious hand once wrote strange words on a palace wall, and only one man could decode their meaning. Find the center where strange code is decoded and understood, every single day.",
    verse: "“This is the interpretation of the message: ...you have been weighed in the balances.” — Daniel 5:26-27",
  },
  {
    id: "CAKE_WORLD",
    name: "Cake World",
    riddle:
      "Every morning bread rained down from heaven, fine as frost, tasting like wafers made with honey — and the land they journeyed toward was promised to flow with milk and honey. Find the shop on campus where such sweetness is still sold.",
    verse: "“It was like white coriander seed, and the taste of it was like wafers made with honey.” — Exodus 16:31",
  },
  {
    id: "BETHESDA",
    name: "Bethesda",
    riddle:
      "By the Sheep Gate in Jerusalem lay a pool with five covered walkways, where a man waited thirty-eight years for the water to stir — until One told him, \"Rise, take up your bed, and walk.\" Find the place on campus that carries this pool's name.",
    verse: "“Now there is in Jerusalem by the Sheep Gate a pool, in Aramaic called Bethesda.” — John 5:2",
  },
];

module.exports = { CS_DEPT, POOL };
