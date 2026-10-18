import { check, variants } from '../js/match.js';
const T = [['be crazy about sb/sth','Be crazy about!',true],['be crazy about sb/sth','be crazy about something',true],['affect (cause emotion)','affect',true],
['afterwards/afterward','afterward',true],['afterwards/afterward','afterwards',true],['fill in/out sth or fill sth in/out','fill out',true],['fill in/out sth or fill sth in/out','fill sth in',true],
["can't stand sb/sth",'cant stand',true],["can't stand sb/sth","can't stand",true],['check-in (desk)','check in',true],['check-in (desk)','check-in desk',true],['abroad','to abroad',true],['abroad','abrod',true],
['such a(n)','such a',true],['such a(n)','such an',true],['at (long) last','at last',true],['at (long) last','at long last',true],['How/What about?','what about',true],['dog','cat',false],['be willing (to do sth)','be willing',true],['be willing (to do sth)','be willing to do',true],
['Attention!','attention',true],['love / (with) love from / all my love/lots of love','lots of love',true],['take a break/rest, etc.','take a rest',true],['bed','bad',false]];
let bad=0; for (const [en,inp,exp] of T){ const r=check(inp,en); if(!!r!==exp){bad++;console.log('FAIL',en,'|',inp,'->',r, variants(en));} }
console.log(bad?bad+' failures':'all '+T.length+' passed');
import fs from 'fs';
const W=JSON.parse(fs.readFileSync(new URL('../data/words.json', import.meta.url))).words;
let f=0; for(const w of W){ if(!check(w.en,w.en)){f++;console.log('self-fail',w.en);} }
console.log('self-check failures',f);
