// Bible-themed clues for each campus location.
// `id` is what gets encoded in that location's QR code (as ?loc=ID).
// `riddle` is shown to a team BEFORE they've found the place — it never
// names the location outright (except CS_DEPT, the known assembly point).
//
// GAME SHAPE: every team's route is
//   CS_DEPT (start) -> 10 random locations from POOL, shuffled -> CS_DEPT (finish)
// Winner = fastest total time between their first and second CS_DEPT scan.

const CS_DEPT = {
  id: "CS_DEPT",
  name: "CS Department",
  // Shown before the team has scanned CS Dept for the first time.
  startText:
    "Every race has a beginning. Yours starts right here. Scan the QR code at the CS Department to start your clock and receive your very first clue.",
  startVerse: "“Let us run with endurance the race that is set before us.” — Hebrews 12:1",
  // Shown after all 10 stops are done, telling them to come back.
  finishText:
    "Ten places found, ten stories walked — now only one place remains: the place where it all began. Return to the CS Department and scan to finish the race.",
  finishVerse: "“I have fought the good fight, I have finished the race, I have kept the faith.” — 2 Timothy 4:7",
};

const POOL = [
  {
    id: "CS_CANTEEN",
    name: "CS Canteen",
    riddle:
      "Five loaves, two fish, a hillside crowd of thousands — yet none went home hungry, and baskets of leftovers remained. Find the place nearby where hunger is answered every single day.",
    verse: "“They all ate and were satisfied, and the disciples picked up twelve baskets full.” — Matthew 14:20",
  },
  {
    id: "CIVIL",
    name: "Civil Department",
    riddle:
      "Joseph, husband of Mary, earned his bread shaping wood and stone — a carpenter by trade. Find the department where today's builders learn to shape beams, stone, and cities.",
    verse: "“Is not this the carpenter's son?” — Matthew 13:55",
  },
  {
    id: "MECH",
    name: "Mechanical Department",
    riddle:
      "Tubal-Cain was the forger of every tool of bronze and iron. And as iron sharpens iron, so one craftsman sharpens another. Find where metal, machines, and minds are shaped together.",
    verse: "“As iron sharpens iron, so one person sharpens another.” — Proverbs 27:17",
  },
  {
    id: "EMMANUEL_AUDI",
    name: "Emmanuel Auditorium",
    riddle:
      "\"His name shall be called Emmanuel\" — which means, God with us. Where the whole assembly gathers as one, in song and one accord, find the hall that carries His name.",
    verse: "“They shall call his name Immanuel, which means, God with us.” — Matthew 1:23",
  },
  {
    id: "ELOHIM_AUDI",
    name: "Elohim Audi",
    riddle:
      "In the beginning, this Mighty Creator made the heavens and the earth — one of the oldest names for God Himself. Find the hall that carries this ancient name.",
    verse: "“In the beginning, God (Elohim) created the heavens and the earth.” — Genesis 1:1",
  },
  {
    id: "ECE",
    name: "ECE Department",
    riddle:
      "\"Let there be light,\" God said, and there was light. Find where light, signals, and circuits are studied and made to obey that same command.",
    verse: "“And God said, ‘Let there be light,’ and there was light.” — Genesis 1:3",
  },
  {
    id: "CTC1",
    name: "Computer Technology Center 1",
    riddle:
      "A mysterious hand once wrote strange words on a palace wall, and only one man could decode their meaning. Find the center where strange code is decoded and understood, every single day.",
    verse: "“This is the interpretation of the message: ...you have been weighed in the balances.” — Daniel 5:26-27",
  },
  {
    id: "CTC2",
    name: "Computer Technology Center 2",
    riddle:
      "Joseph could interpret dreams that no wise man of Egypt could decode. Find the second center where interpreters of code are trained and tested.",
    verse: "“Can we find such a one as this, a man in whom is the Spirit of God?” — Genesis 41:38",
  },
  {
    id: "LIBRARY",
    name: "Central Library",
    riddle:
      "In the beginning was the Word, and the Word was with God. Long before screens, His words were copied by hand and kept on scrolls. Find the quiet hall where words still live on shelves.",
    verse: "“In the beginning was the Word, and the Word was with God.” — John 1:1",
  },
  {
    id: "CHANDRAN",
    name: "Chandran Stores",
    riddle:
      "He drove out those who bought and sold, saying His house should be a house of prayer, not a den of merchants. Find today's marketplace on campus, where buying and selling still happen.",
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
    id: "MECH_CANTEEN",
    name: "Mechanical Canteen",
    riddle:
      "At a wedding in Cana, six stone jars of water became the finest wine — the first of His miracles, done quietly among the servants. Find the table on campus where mechanical minds go to refuel.",
    verse: "“This, the first of his signs, Jesus did at Cana in Galilee.” — John 2:11",
  },
  {
    id: "CAKE_WORLD_1",
    name: "Cake World 1",
    riddle:
      "Every morning, bread rained down from heaven, fine as frost, tasting like wafers made with honey. Find the first sweet shop on campus where such treats can still be found today.",
    verse: "“It was like white coriander seed... and the taste of it was like wafers made with honey.” — Exodus 16:31",
  },
  {
    id: "CAKE_WORLD_2",
    name: "Cake World 2",
    riddle:
      "A land promised long ago was said to flow with milk and honey. Find the second sweet shop on campus, where that old promise still holds true.",
    verse: "“A land flowing with milk and honey.” — Exodus 3:8",
  },
];

module.exports = { CS_DEPT, POOL };
