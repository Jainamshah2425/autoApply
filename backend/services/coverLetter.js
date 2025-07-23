// services/coverLetter.js
const { getLLMResponse } = require('./llm');

async function generateCoverLetter({ jobTitle, companyName, skills, resumeText }) {
  const prompt = `You are a professional HR assistant. Your task is to write a tailored and complete cover letter.
The output must be only a ready-to-send email body nothing else,avoid adding first line as here is the tailor version or anything like that,strictly start with email only.
It must start with "Dear Hiring Manager," and end with a professional closing.
Crucially, you must use the provided resume to highlight relevant experience and skills.

Please generate a cover letter for the following position:
- Job Title: ${jobTitle}
- Company: ${companyName}

The candidate has the following skills:
- ${skills}

Here is the candidate's resume. Use it to tailor the cover letter:
--- START RESUME ---
${resumeText}
--- END RESUME ---`;

  const letter = await getLLMResponse(prompt);
  return letter;
}


module.exports = { generateCoverLetter };
