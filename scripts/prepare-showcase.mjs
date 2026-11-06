// Creates a NEW database from schema + explicitly allowed integration settings.
// Never copies leads, searches, team records, messages or AI history.
import {DatabaseSync} from 'node:sqlite';
import {mkdir,cp,access} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
export async function prepareShowcase(sourcePath,destinationDirectory) {
  const directory=resolve(destinationDirectory),destination=resolve(directory,'showcase.db');
  try{await access(destination);throw new Error('Showcase already exists. Reuse it; do not reset visitor data implicitly.');}catch(error){if(error.code!=='ENOENT')throw error;}
  await mkdir(directory,{recursive:true});
  const source=new DatabaseSync(sourcePath,{readOnly:true});let target;
  try {
    await cp(resolve(dirname(sourcePath),'keys'),resolve(directory,'keys'),{recursive:true,errorOnExist:true,force:false});
    target=new DatabaseSync(destination);
    const tables = new Set(["Staff","Categories","Leads","LeadChecks","OutreachLog","Settings","LinkedInAccounts","Searches","AiUsage"]);
    for(const row of source.prepare("SELECT name,sql FROM sqlite_master WHERE type='table'").all())if(tables.has(row.name))target.exec(row.sql);
    for(const row of source.prepare("SELECT tbl_name,sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL").all())if(tables.has(row.tbl_name))target.exec(row.sql);
    const owner=randomUUID(),now=new Date().toISOString();
    target.prepare('INSERT INTO Staff (Id,Name,Email,PasswordHash,Role,Active,CreatedAt) VALUES (?,?,?,?,?,?,?)').run(owner,'Showcase workspace','showcase@example.invalid','','Admin',1,now);
    const setting=target.prepare('INSERT INTO Settings (Key,Value) VALUES (?,?)');
    setting.run('workspaceOwnerId',owner);
    for(const key of ['geminiKey','geminiModel','linkedinClientId','linkedinClientSecret','linkedinCallback']){
      const row=source.prepare('SELECT Value FROM Settings WHERE Key=?').get(key);if(row)setting.run(key,row.Value);
    }
    // A showcase has its own conservative request allowance. Provider quota is still shared.
    setting.run('aiDailyLimit','30');
    const account=source.prepare('SELECT Sub,Name,ProtectedToken,ExpiresAt FROM LinkedInAccounts WHERE StaffId=(SELECT Value FROM Settings WHERE Key=?)').get('workspaceOwnerId');
    if(account)target.prepare('INSERT INTO LinkedInAccounts (StaffId,Sub,Name,Email,ProtectedToken,ExpiresAt) VALUES (?,?,?,?,?,?)').run(owner,account.Sub,account.Name,'',account.ProtectedToken,account.ExpiresAt);
    for(const table of ['Leads','LeadChecks','OutreachLog','Searches','AiUsage'])if(target.prepare('SELECT COUNT(*) AS n FROM '+table).get().n!==0)throw new Error('Showcase isolation failed: '+table);
    return {database:destination,empty:true,linkedInCopied:!!account};
  }finally{target?.close();source.close();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const root=resolve(import.meta.dirname,'..');
 const result=await prepareShowcase(resolve(root,'server/.data/leaddesk.db'),resolve(root,'artifacts/showcase-data'));
 console.log(JSON.stringify({empty:result.empty,linkedInCopied:result.linkedInCopied}));
}
