const axios = require('axios');
const cheerio = require('cheerio');

const url = 'https://internshala.com/internships/web-development-internship/';

axios
  .get(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  })
  .then((res) => {
    const $ = cheerio.load(res.data);
    console.log('title:', $('title').text().trim());
    console.log('containers:', $('.individual_internship').length);

    const first = $('.individual_internship').first();
    console.log('\n--- first card HTML snippet ---');
    console.log(first.html()?.slice(0, 1500));

    console.log('\n--- selectors test ---');
    const tests = [
      '.heading_4_5',
      '.profile h3',
      '.profile',
      'h3.heading_4_5',
      'a.job-title',
      '.job-title',
      '.internship-heading',
      'h3',
      'h4',
    ];
    for (const sel of tests) {
      console.log(sel, '=>', first.find(sel).first().text().trim().slice(0, 80));
    }
  })
  .catch((e) => console.error(e.message, e.response?.status));
