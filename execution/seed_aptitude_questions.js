/**
 * seed_aptitude_questions.js
 * Seeds the MongoDB aptitude_questions collection with curated questions.
 * 
 * Usage: node execution/seed_aptitude_questions.js
 * (Run from the project root — it reads .env from there)
 */

const fs = require('fs');
const path = require('path');
const mongoose = require(path.join(__dirname, '..', 'backend', 'node_modules', 'mongoose'));

// Manually load .env (to avoid needing dotenv in execution/)
const envFiles = [
  path.join(__dirname, '..', '.env'),
  path.join(__dirname, '..', 'backend', '.env')
];
for (const ef of envFiles) {
  if (fs.existsSync(ef)) {
    fs.readFileSync(ef, 'utf8').split('\n').forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) return;
      const key = trimmed.substring(0, eqIdx).trim();
      const val = trimmed.substring(eqIdx + 1).trim();
      if (key && val) process.env[key] = val;
    });
  }
}

// Import the model
const AptitudeQuestion = require(path.join(__dirname, '..', 'backend', 'models', 'AptitudeQuestion.js'));

const QUESTIONS = [
  // ═══ QUANTITATIVE — Percentages ═══
  {questionText:"What is 25% of 480?",options:["100","110","120","130"],correctAnswer:2,explanation:"25% of 480 = (25/100) × 480 = 120",shortcutMethod:"25% = 1/4, so 480/4 = 120",topic:"percentages",category:"quantitative",difficulty:"easy",companyTags:["TCS","Infosys"],averageTimeSeconds:30},
  {questionText:"A price increases from ₹200 to ₹250. What is the percentage increase?",options:["20%","25%","30%","50%"],correctAnswer:1,explanation:"Increase = 50. Percentage = (50/200) × 100 = 25%",topic:"percentages",category:"quantitative",difficulty:"easy",companyTags:["Wipro","TCS"],averageTimeSeconds:30},
  {questionText:"If 40% of a number is 120, what is 60% of that number?",options:["160","170","180","200"],correctAnswer:2,explanation:"Number = 120/0.4 = 300. 60% of 300 = 180",shortcutMethod:"60/40 × 120 = 1.5 × 120 = 180",topic:"percentages",category:"quantitative",difficulty:"medium",companyTags:["Cognizant"],averageTimeSeconds:45},
  {questionText:"A shopkeeper marks up an item by 40% and then offers a 20% discount. What is the net profit %?",options:["8%","10%","12%","20%"],correctAnswer:2,explanation:"Let CP = 100. MP = 140. SP = 140 × 0.8 = 112. Profit = 12%",shortcutMethod:"Successive: 40 - 20 - (40×20)/100 = 12%",topic:"percentages",category:"quantitative",difficulty:"medium",companyTags:["TCS","Accenture"],averageTimeSeconds:60},

  // ═══ QUANTITATIVE — Profit & Loss ═══
  {questionText:"An article bought for ₹500 is sold for ₹600. What is the profit percentage?",options:["10%","15%","20%","25%"],correctAnswer:2,explanation:"Profit = 100. Profit% = (100/500) × 100 = 20%",topic:"profit-loss",category:"quantitative",difficulty:"easy",companyTags:["TCS","Infosys"],averageTimeSeconds:30},
  {questionText:"A trader sells goods at 10% loss. If he had sold them for ₹90 more, he would have gained 5%. Find the cost price.",options:["₹500","₹600","₹700","₹800"],correctAnswer:1,explanation:"Let CP = x. 0.9x + 90 = 1.05x → 0.15x = 90 → x = 600",topic:"profit-loss",category:"quantitative",difficulty:"medium",companyTags:["Wipro","Cognizant"],averageTimeSeconds:60},
  {questionText:"By selling 12 articles, a vendor gains the selling price of 2 articles. Find the gain percent.",options:["16.67%","20%","25%","10%"],correctAnswer:1,explanation:"Gain = 2SP. So 12CP = 10SP → SP/CP = 12/10 = 1.2 → Gain = 20%",topic:"profit-loss",category:"quantitative",difficulty:"hard",companyTags:["TCS","Capgemini"],averageTimeSeconds:75},

  // ═══ QUANTITATIVE — Time & Work ═══
  {questionText:"A can do a job in 10 days, B in 15 days. How many days will they take together?",options:["5","6","7","8"],correctAnswer:1,explanation:"Rate = 1/10 + 1/15 = 5/30 = 1/6. Days = 6",shortcutMethod:"LCM(10,15)=30. A=3, B=2, total=5. 30/5=6 days",topic:"time-work",category:"quantitative",difficulty:"easy",companyTags:["TCS","Infosys","Wipro"],averageTimeSeconds:45},
  {questionText:"A can do a work in 12 days. B is 50% more efficient than A. How many days does B take?",options:["6","7","8","9"],correctAnswer:2,explanation:"B is 50% more efficient, so B does 1.5×(1/12) = 1/8 per day. B takes 8 days.",topic:"time-work",category:"quantitative",difficulty:"medium",companyTags:["TCS"],averageTimeSeconds:45},
  {questionText:"A and B can do a job in 12 days. B and C in 15 days. A and C in 20 days. How long will all three together take?",options:["8 days","10 days","5 days","9 days"],correctAnswer:1,explanation:"2(A+B+C) = 1/12+1/15+1/20 = 12/60 = 1/5. A+B+C = 1/10. Days = 10",topic:"time-work",category:"quantitative",difficulty:"hard",companyTags:["Capgemini","Cognizant"],averageTimeSeconds:90},

  // ═══ QUANTITATIVE — Speed, Time, Distance ═══
  {questionText:"A train 150m long crosses a pole in 10 seconds. What is its speed in km/h?",options:["45","50","54","60"],correctAnswer:2,explanation:"Speed = 150/10 = 15 m/s = 15 × 18/5 = 54 km/h",shortcutMethod:"m/s to km/h: multiply by 18/5",topic:"speed-time-distance",category:"quantitative",difficulty:"easy",companyTags:["TCS","Infosys"],averageTimeSeconds:30},
  {questionText:"A person covers 200 km at 40 km/h and 300 km at 60 km/h. What is the average speed?",options:["48 km/h","50 km/h","52 km/h","55 km/h"],correctAnswer:1,explanation:"Total distance = 500. Total time = 5+5 = 10. Avg speed = 500/10 = 50 km/h",topic:"speed-time-distance",category:"quantitative",difficulty:"medium",companyTags:["Wipro","TCS"],averageTimeSeconds:60},

  // ═══ QUANTITATIVE — Ratios ═══
  {questionText:"If A:B = 3:4 and B:C = 5:6, find A:B:C.",options:["15:20:24","3:4:6","9:12:16","15:20:25"],correctAnswer:0,explanation:"Make B common: A:B = 15:20, B:C = 20:24. So A:B:C = 15:20:24",topic:"ratios",category:"quantitative",difficulty:"medium",companyTags:["TCS","Infosys"],averageTimeSeconds:45},
  {questionText:"Two numbers are in the ratio 3:5. If 9 is added to each, the ratio becomes 3:4. Find the numbers.",options:["9,15","15,25","27,45","12,20"],correctAnswer:2,explanation:"3x+9 : 5x+9 = 3:4. 12x+36 = 15x+27. 3x=9. x=9 → 27,45",topic:"ratios",category:"quantitative",difficulty:"medium",companyTags:["Wipro"],averageTimeSeconds:60},

  // ═══ QUANTITATIVE — Interest ═══
  {questionText:"Find the simple interest on ₹5000 at 8% per annum for 3 years.",options:["₹1000","₹1100","₹1200","₹1300"],correctAnswer:2,explanation:"SI = PNR/100 = 5000×3×8/100 = 1200",topic:"interest",category:"quantitative",difficulty:"easy",companyTags:["TCS","Infosys"],averageTimeSeconds:30},
  {questionText:"What is the compound interest on ₹10000 at 10% for 2 years?",options:["₹2000","₹2050","₹2100","₹2200"],correctAnswer:2,explanation:"A = 10000(1.1)² = 12100. CI = 2100",shortcutMethod:"CI-SI = P(R/100)² for 2 years. SI=2000, extra=100. CI=2100",topic:"interest",category:"quantitative",difficulty:"medium",companyTags:["Cognizant","Capgemini"],averageTimeSeconds:60},

  // ═══ QUANTITATIVE — Number Series ═══
  {questionText:"Find the next number: 2, 6, 12, 20, 30, ?",options:["40","42","44","46"],correctAnswer:1,explanation:"Differences: 4,6,8,10,12. Next = 30+12 = 42",shortcutMethod:"Pattern: n(n+1). For n=6: 42",topic:"number-series",category:"quantitative",difficulty:"easy",companyTags:["TCS","Infosys","Wipro"],averageTimeSeconds:45},
  {questionText:"Find the next number: 3, 8, 15, 24, 35, ?",options:["46","48","50","52"],correctAnswer:1,explanation:"Differences: 5,7,9,11,13. Next = 35+13 = 48",topic:"number-series",category:"quantitative",difficulty:"medium",companyTags:["TCS"],averageTimeSeconds:45},

  // ═══ QUANTITATIVE — Probability ═══
  {questionText:"Two dice are thrown. What is the probability of getting a sum of 7?",options:["1/6","5/36","1/9","7/36"],correctAnswer:0,explanation:"Favorable: (1,6),(2,5),(3,4),(4,3),(5,2),(6,1) = 6. P = 6/36 = 1/6",topic:"probability",category:"quantitative",difficulty:"medium",companyTags:["TCS","Cognizant"],averageTimeSeconds:45},
  {questionText:"A bag has 4 red and 6 blue balls. Two balls are drawn. Probability both are red?",options:["2/15","1/15","4/45","1/5"],correctAnswer:0,explanation:"P = C(4,2)/C(10,2) = 6/45 = 2/15",topic:"probability",category:"quantitative",difficulty:"medium",companyTags:["Infosys","Wipro"],averageTimeSeconds:60},

  // ═══ QUANTITATIVE — Permutation/Combination ═══
  {questionText:"In how many ways can 5 people be seated in a row?",options:["60","120","24","720"],correctAnswer:1,explanation:"5! = 120",topic:"permutation-combination",category:"quantitative",difficulty:"easy",companyTags:["TCS"],averageTimeSeconds:15},
  {questionText:"How many ways can a committee of 3 be formed from 8 people?",options:["56","336","40320","24"],correctAnswer:0,explanation:"C(8,3) = 8!/(3!5!) = 56",topic:"permutation-combination",category:"quantitative",difficulty:"easy",companyTags:["Infosys","Wipro"],averageTimeSeconds:30},

  // ═══ QUANTITATIVE — Averages ═══
  {questionText:"The average of 5 numbers is 20. If one number is removed, the average becomes 18. What is the removed number?",options:["24","26","28","30"],correctAnswer:2,explanation:"Sum = 100. New sum = 72. Removed = 28",topic:"averages",category:"quantitative",difficulty:"easy",companyTags:["TCS","Wipro"],averageTimeSeconds:30},

  // ═══ LOGICAL — Syllogisms ═══
  {questionText:"All dogs are animals. All animals are living beings. Which conclusion is correct?",options:["All dogs are living beings","All living beings are dogs","Some animals are not dogs","None of these"],correctAnswer:0,explanation:"dogs ⊂ animals ⊂ living beings → all dogs are living beings",topic:"syllogisms",category:"logical",difficulty:"easy",companyTags:["TCS","Infosys"],averageTimeSeconds:30},
  {questionText:"Some teachers are doctors. All doctors are engineers. Which statement must be true?",options:["All teachers are engineers","Some teachers are engineers","All engineers are doctors","Some engineers are teachers"],correctAnswer:1,explanation:"Some teachers are doctors, all doctors are engineers → some teachers are engineers",topic:"syllogisms",category:"logical",difficulty:"medium",companyTags:["Wipro","Cognizant"],averageTimeSeconds:45},

  // ═══ LOGICAL — Blood Relations ═══
  {questionText:"Pointing to a man, a woman said 'His mother is the only daughter of my mother.' How is the woman related to the man?",options:["Mother","Daughter","Sister","Aunt"],correctAnswer:0,explanation:"'Only daughter of my mother' = the woman herself. So she is the man's mother.",topic:"blood-relations",category:"logical",difficulty:"medium",companyTags:["TCS","Infosys","Wipro"],averageTimeSeconds:45},
  {questionText:"A is the father of B. C is the daughter of B. D is the wife of A. How is D related to C?",options:["Mother","Grandmother","Sister","Aunt"],correctAnswer:1,explanation:"D is A's wife = B's mother. C is B's daughter. D is C's grandmother.",topic:"blood-relations",category:"logical",difficulty:"easy",companyTags:["TCS"],averageTimeSeconds:30},

  // ═══ LOGICAL — Coding-Decoding ═══
  {questionText:"If COMPUTER is coded as DPNQVUFS, how is MOBILE coded?",options:["NPCJMF","NPKCMF","NPCJME","NPBJMF"],correctAnswer:0,explanation:"Each letter +1. M→N, O→P, B→C, I→J, L→M, E→F",topic:"coding-decoding",category:"logical",difficulty:"easy",companyTags:["TCS","Infosys"],averageTimeSeconds:45},
  {questionText:"If ROSE is coded as 6821 and CHAIR is coded as 73456, what is the code for SEARCH?",options:["214673","214637","216473","214367"],correctAnswer:0,explanation:"S=2, E=1, A=4, R=6, C=7, H=3. SEARCH = 214673",topic:"coding-decoding",category:"logical",difficulty:"medium",companyTags:["Wipro","Cognizant"],averageTimeSeconds:60},

  // ═══ LOGICAL — Seating Arrangement ═══
  {questionText:"Five people A,B,C,D,E sit in a row. A sits next to B. C sits next to D. E sits at one end. B sits in the middle. Who sits at the other end?",options:["A","C","D","Cannot determine"],correctAnswer:2,explanation:"B at position 3, A next to B. E at one end. C and D together → D at other end.",topic:"seating-arrangement",category:"logical",difficulty:"medium",companyTags:["TCS","Infosys"],averageTimeSeconds:90},

  // ═══ LOGICAL — Pattern Recognition ═══
  {questionText:"Find the odd one out: 2, 5, 10, 17, 26, 37, 50, 64",options:["37","50","64","26"],correctAnswer:2,explanation:"Pattern: n²+1. 8²+1=65, not 64. So 64 is wrong.",topic:"pattern-recognition",category:"logical",difficulty:"medium",companyTags:["TCS","Capgemini"],averageTimeSeconds:60},

  // ═══ LOGICAL — Data Sufficiency ═══
  {questionText:"Is x positive? (I) x² > 0 (II) x³ > 0. Which statement(s) are sufficient?",options:["I alone","II alone","Both together","Neither"],correctAnswer:1,explanation:"I: x²>0 means x≠0 but could be negative. II: x³>0 means x>0. II alone suffices.",topic:"data-sufficiency",category:"logical",difficulty:"hard",companyTags:["Cognizant","Capgemini"],averageTimeSeconds:60},

  // ═══ VERBAL — Various ═══
  {questionText:"'The early bird catches the worm' — what does this proverb convey?",options:["Birds eat worms","Being early gives an advantage","Morning is the best time","Hard work is important"],correctAnswer:1,explanation:"This means those who act early have an advantage.",topic:"reading-comprehension",category:"verbal",difficulty:"easy",companyTags:["TCS","Infosys"],averageTimeSeconds:20},
  {questionText:"Identify the grammatically correct sentence:",options:["He don't know nothing","She is more taller than him","They have been working since morning","I seen that movie yesterday"],correctAnswer:2,explanation:"'Have been working since' is correct present perfect continuous.",topic:"sentence-correction",category:"verbal",difficulty:"easy",companyTags:["TCS","Wipro"],averageTimeSeconds:30},
  {questionText:"Choose the correct sentence:",options:["Each of the students have submitted their work","Each of the students has submitted his work","Each of students has submitted their work","Each of the student has submitted their work"],correctAnswer:1,explanation:"'Each' takes singular verb 'has' and singular pronoun.",topic:"sentence-correction",category:"verbal",difficulty:"medium",companyTags:["Infosys","Cognizant"],averageTimeSeconds:30},
  {questionText:"PEN : WRITE :: KNIFE : ?",options:["SHARP","CUT","BLADE","STAB"],correctAnswer:1,explanation:"Pen is used to write; knife is used to cut. Tool → Function.",topic:"analogies",category:"verbal",difficulty:"easy",companyTags:["TCS","Infosys"],averageTimeSeconds:20},
  {questionText:"DOCTOR : HOSPITAL :: TEACHER : ?",options:["BOOKS","SCHOOL","STUDENT","EDUCATION"],correctAnswer:1,explanation:"Doctor works in hospital; teacher works in school.",topic:"analogies",category:"verbal",difficulty:"easy",companyTags:["TCS"],averageTimeSeconds:15},
  {questionText:"The company's profits _____ by 20% last quarter due to increased sales.",options:["raised","rose","risen","raise"],correctAnswer:1,explanation:"'Rose' is past tense of 'rise' (intransitive). Profits 'rose'.",topic:"fill-in-blanks",category:"verbal",difficulty:"medium",companyTags:["TCS","Wipro"],averageTimeSeconds:30},
  {questionText:"Arrange: (A) He studied hard (B) He passed with distinction (C) He had an exam next week (D) He was very happy",options:["CABD","ABCD","CDAB","ACBD"],correctAnswer:0,explanation:"Exam→Studied→Passed→Happy. C→A→B→D",topic:"para-jumbles",category:"verbal",difficulty:"medium",companyTags:["Cognizant","Capgemini"],averageTimeSeconds:60},
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('📦 Connected to MongoDB');

    const existing = await AptitudeQuestion.countDocuments();
    console.log(`📊 Existing questions: ${existing}`);

    if (existing >= QUESTIONS.length) {
      console.log('✅ Already seeded. Skipping.');
      return;
    }

    await AptitudeQuestion.deleteMany({});
    const result = await AptitudeQuestion.insertMany(QUESTIONS);
    console.log(`✅ Seeded ${result.length} aptitude questions.`);

    // Summary
    const cats = {};
    QUESTIONS.forEach(q => { cats[q.category] = (cats[q.category] || 0) + 1; });
    Object.entries(cats).forEach(([cat, count]) => console.log(`   ${cat}: ${count}`));
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
  } finally {
    await mongoose.disconnect();
  }
}

seed();
