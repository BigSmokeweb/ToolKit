import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {resolve,join,sep} from 'node:path';
import {prepareShowcase} from './prepare-showcase.mjs';
test('copies integration settings into a fresh workspace without any existing user content',async()=>{
 const artifacts=resolve(import.meta.dirname,'../artifacts'),root=join(artifacts,'isolation-test-'+Date.now()),sourceDir=join(root,'source'),destination=join(root,'showcase');
 await mkdir(join(sourceDir,'keys'),{recursive:true});await writeFile(join(sourceDir,'keys/key.xml'),'fake-encrypted-keyring');
 const sourcePath=join(sourceDir,'test.db'),source=new DatabaseSync(sourcePath);
 for(const table of ['Leads','LeadChecks','OutreachLog','Searches','AiUsage']){source.exec('CREATE TABLE '+table+' (Content TEXT)');source.prepare('INSERT INTO '+table+' VALUES (?)').run('PRIVATE CONTENT');}
 source.exec('CREATE TABLE Staff (Id TEXT, Name TEXT, Email TEXT, PasswordHash TEXT, Role TEXT, Active INTEGER, CreatedAt TEXT); CREATE TABLE Settings (Key TEXT PRIMARY KEY,Value TEXT); CREATE TABLE LinkedInAccounts (StaffId TEXT,Sub TEXT,Name TEXT,Email TEXT,ProtectedToken TEXT,ExpiresAt TEXT);');
 source.prepare('INSERT INTO Settings VALUES (?,?)').run('workspaceOwnerId','original-owner');source.prepare('INSERT INTO Settings VALUES (?,?)').run('geminiKey','encrypted-example');source.prepare('INSERT INTO Settings VALUES (?,?)').run('browserCaptureCredential','must-not-copy');
 source.prepare('INSERT INTO Staff VALUES (?,?,?,?,?,?,?)').run('original-owner','PRIVATE TEAM','private@example.test','legacy-password','Admin',1,'2026-01-01');source.prepare('INSERT INTO LinkedInAccounts VALUES (?,?,?,?,?,?)').run('original-owner','subject','Connected owner','private@example.test','encrypted-token','2027-01-01');source.close();
 try{
  assert.equal((await prepareShowcase(sourcePath,destination)).empty,true);
  const target=new DatabaseSync(join(destination,'showcase.db'),{readOnly:true});
  for(const table of ['Leads','LeadChecks','OutreachLog','Searches','AiUsage'])assert.equal(target.prepare('SELECT COUNT(*) AS n FROM '+table).get().n,0);
  assert.equal(target.prepare('SELECT Value FROM Settings WHERE Key=?').get('geminiKey').Value,'encrypted-example');assert.equal(target.prepare('SELECT Value FROM Settings WHERE Key=?').get('browserCaptureCredential'),undefined);
  const owner=target.prepare('SELECT * FROM Staff').get();assert.notEqual(owner.Id,'original-owner');assert.equal(owner.Name,'Showcase workspace');assert.equal(owner.PasswordHash,'');const account=target.prepare('SELECT * FROM LinkedInAccounts').get();assert.equal(account.StaffId,owner.Id);assert.equal(account.ProtectedToken,'encrypted-token');assert.equal(account.Email,'');target.close();
  assert.equal(await readFile(join(destination,'keys/key.xml'),'utf8'),'fake-encrypted-keyring');
  await assert.rejects(prepareShowcase(sourcePath,destination),/already exists/);
  const original=new DatabaseSync(sourcePath,{readOnly:true});assert.equal(original.prepare('SELECT COUNT(*) AS n FROM Leads').get().n,1);original.close();
 }finally{if(!root.startsWith(artifacts+sep))throw new Error('Unsafe cleanup path');await rm(root,{recursive:true,force:true});}
});
