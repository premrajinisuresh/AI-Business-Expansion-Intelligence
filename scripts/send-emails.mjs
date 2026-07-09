// Starter file
import fs from 'node:fs';

const db='buyerdatabase5.json';

if(!fs.existsSync(db)){
  console.error('Database not found');
  process.exit(1);
}

const leads=JSON.parse(fs.readFileSync(db,'utf8'));
const emailLeads=leads.filter(x=>x.email);

console.log(`Found ${emailLeads.length} leads with email addresses.`);
console.log('Next step: integrate Resend API.');
