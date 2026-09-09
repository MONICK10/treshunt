// Bible-themed clues for each campus location.
// `id` is what gets encoded in that location's QR code (as ?loc=ID).
// `riddle` is shown to a team BEFORE they've found the place. Each clue has
// two parts: a short Bible story with a recall question, then a "->" pointer
// question that steers them to the campus spot.
//
// GAME SHAPE: every team's route is
//   CS_DEPT (start) -> all 12 POOL locations in a fixed order -> CS_DEPT (finish)
// There are 12 fixed routes ("Group 1".."Group 12"), one per team (see seed.js).
// Winner = fastest total time between their first and second CS_DEPT scan.

const CS_DEPT = {
  id: "CS_DEPT",
  name: "CS Department",
  // Shown before the team has scanned CS Dept for the first time. CS Dept is
  // the known assembly point, so this one just tells them to start.
  startText:
    "Every race has a beginning. Yours starts right here. Scan the QR code at the CS Department to start your clock and receive your very first clue.",
  startVerse: "“Let us run with endurance the race that is set before us.” — Hebrews 12:1",
  // Shown after all 12 stops are done — the final clue home.
  finishText:
    "Jesus told a story about a son who wandered far, wasted everything, then turned around and went home — and his father ran to meet him. (Luke 15) Where did the son return to? → Go back to the place you return to every day, and scan there to finish the race.",
  finishVerse: "“He arose and came to his father.” — Luke 15:20",
};

const POOL = [
  {
    id: "CANTEEN",
    name: "Canteen",
    riddle:
      "Jesus fed five thousand people on a hillside with only five loaves and two fish. What did He feed them? → Where do you go to get food on this campus?",
    verse: "“They all ate and were satisfied.” — Matthew 14:20",
  },
  {
    id: "EMMANUEL_AUDI",
    name: "Emmanuel Auditorium",
    riddle:
      "\"The virgin shall conceive and bear a Son, and they shall call His name ____.\" Fill in the blank. → Which building on campus has that name written on it?",
    verse: "“They shall call his name Immanuel (God with us).” — Isaiah 7:14 / Matthew 1:23",
  },
  {
    id: "MECH",
    name: "Mechanical Department",
    riddle:
      "Tubal-Cain was the first man to forge tools of iron and bronze. What did he work with? → Where do you go to learn about machines and metal?",
    verse: "“Tubal-Cain, forger of all instruments of bronze and iron.” — Genesis 4:22",
  },
  {
    id: "CIVIL",
    name: "Civil Department",
    riddle:
      "Joseph, the earthly father of Jesus, had a trade he worked with his hands. What was his job? → Where do you go to learn how to build things?",
    verse: "“Is this not the carpenter's son?” — Matthew 13:55",
  },
  {
    id: "CHANDRAN",
    name: "Chandran Stores",
    riddle:
      "Esau came in from the field so hungry that he sold his birthright for a single bowl of stew. What was he feeling? → Where do you go when you're hungry and just want a snack?",
    verse: "“Esau despised his birthright.” — Genesis 25:34",
  },
  {
    id: "AGRI",
    name: "Agriculture Department",
    riddle:
      "In the parable, a farmer went out and scattered something across his field. What was he sowing? → Where do you go to learn about farming and crops?",
    verse: "“A sower went out to sow.” — Matthew 13:3",
  },
  {
    id: "MEDIA",
    name: "Media Department",
    riddle:
      "Jesus said, \"What you hear whispered, proclaim from the housetops.\" What did He tell them to do? → Where do you go to record and share news on campus?",
    verse: "“What you hear, proclaim from the housetops.” — Matthew 10:27",
  },
  {
    id: "LIBRARY",
    name: "Central Library",
    riddle:
      "Hilkiah the priest was clearing the temple when he found the lost Book of the Law. What did he find? → Where do you go to find thousands of books?",
    verse: "“I have found the Book of the Law in the house of the LORD.” — 2 Kings 22:8",
  },
  {
    id: "CTC1",
    name: "Computer Technology Center 1",
    riddle:
      "John was told to write down what he saw and send the scroll to the seven churches. What was he told to do? → Where do you go to type, not write? Start with the first lab.",
    verse: "“Write what you see in a book and send it.” — Revelation 1:11",
  },
  {
    id: "CAKE_WORLD",
    name: "Cake World",
    riddle:
      "During the famine, Elijah asked the widow of Zarephath to bake him a small cake of bread first. What did he ask her to make? → Where do you go to buy one?",
    verse: "“Make me a little cake of it first.” — 1 Kings 17:13",
  },
  {
    id: "BETHESDA",
    name: "Bethesda",
    riddle:
      "By a pool with five covered walkways, a sick man waited thirty-eight years for the water to stir. What was the name of that pool? → Which building here carries the same name?",
    verse: "“There is in Jerusalem a pool called Bethesda.” — John 5:2",
  },
  {
    id: "AEROSPACE",
    name: "Aerospace Department",
    riddle:
      "As Elijah and Elisha walked together, a chariot of fire and horses of fire appeared, and Elijah was carried up in a whirlwind. Which direction did he go? → Where do you go to learn about things that fly?",
    verse: "“Elijah went up by a whirlwind into heaven.” — 2 Kings 2:11",
  },
];

module.exports = { CS_DEPT, POOL };
