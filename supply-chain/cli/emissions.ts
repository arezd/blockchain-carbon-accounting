import 'dotenv/config';
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { sep } from 'path';
import { generateKeyPair, hash_content } from 'supply-chain-lib/src/crypto-utils';
import {
  GroupedResult,
  GroupedResults,
  group_processed_activities,
  issue_tokens,
  process_activities,
  process_emissions_requests,
  queue_issue_tokens
} from 'supply-chain-lib/src/emissions-utils';
import { downloadFileEncrypted } from 'supply-chain-lib/src/ipfs-utils';

function print_usage() {
  console.log('Usage: node emissions.js [-f input.json] [-pubk pubkey1.pem] [-pubk pubkey2.pem] ...');
  console.log('  -f input.json: the JSON file containing the activities array.');
  console.log('  -pubk pubkey.pem: is used to encrypt content put on IPFS (can use multiple keys to encrypt for multiple users).');
  console.log('  -pk privatekey.pem: is used to decrypt content (only when fetching content from IPFS).');
  console.log('  -generatekeypair name: generates a name-privatekey.pem and name-publickey.pem which can be used as -pk and -pubk respectively.');
  console.log('  -fetch objectpath: fetch the ipfs://<objectpath> object, if -pk is given will decrypt the file with it.');
  console.log('  -queue: create EmissionsRequest instead of issuing the token');
  console.log('  -processrequests: process EmissionsRequests, get and randomly assign emission auditors');
  console.log('  -v or --verbose to switch to a more verbose output format.');
  console.log('  -h or --help displays this message.');
  console.log('');
  console.log('By default returns a JSON array of { id, tokenId, error }');
  console.log('In verbose output format returns a JSON object of the activities grouped by type (and shipments are also grouped by mode) with the results of distance, emissions and issued tokens.');
}

const args = process.argv.splice( /ts-node/.test(process.argv[0]) || /node$/.test(process.argv[0]) ? 2 : 1 );
let source: string|undefined = undefined;
const publicKeys: string[] = [];
let privateKey: string|undefined = undefined;
let fetchObjectPath: string|undefined = undefined;
let pretend = false;
let verbose = false;
let queue = false;
let processrequests = false;
const generatedKeypairs: string[] = [];

// parse arguments
// -h or --help
// -v or --verbose
// -fetch <ipfs_content_id>
// -pk <filename>
// -pubk <filename>
// -generatekeypair <name>
// -queue
for (let i=0; i<args.length; i++) {
  let a = args[i];
  if (a === '-f') {
    i++;
    if (i == args.length) throw new Error('Missing argument filename after -f');
    source = args[i];
  } else if (a === '-pubk') {
    i++;
    if (i == args.length) throw new Error('Missing argument filename after -pubk');
    a = args[i];
    publicKeys.push(a);
  } else if (a === '-generatekeypair') {
    i++;
    if (i == args.length) throw new Error('Missing argument name after -generatekeypair');
    a = args[i];
    generateKeyPair(a);
    generatedKeypairs.push(a);
  } else if (a === '-pk') {
    i++;
    if (i == args.length) throw new Error('Missing argument filename after -pk');
    a = args[i];
    if (privateKey) throw new Error('Cannot define multiple privateKey');
    privateKey = a;
  } else if (a === '-fetch') {
    i++;
    if (i == args.length) throw new Error('Missing argument objectpath after -fetch');
    if (fetchObjectPath) throw new Error('Cannot define multiple objects to fetch');
    a = args[i];
    fetchObjectPath = a;
  } else if (a === '-p' || a === '-pretend' || a === '--pretend') {
    pretend = true;
  } else if (a === '-v' || a === '-verbose' || a === '--verbose') {
    verbose = true;
  } else if (a === '-h' || a === '-help' || a === '--help') {
    print_usage();
    process.exit();
  } else if (a === '-queue') {
    queue = true;
  } else if (a === '-processrequests') {
    processrequests = true;
  } else {
    console.error(`Unrecognized argument ${a}`);
    print_usage();
    process.exit();
  }
}

type OutputActivity = {
  id: string,
  tokenId?: string,
  error?: string
};

async function process_group(output_array: OutputActivity[], g: GroupedResult, activity_type: string, publicKeys: string[], mode?: string) {
  const token_res = queue ? 
    await queue_issue_tokens(g, activity_type, mode) :
    await issue_tokens(g, activity_type, publicKeys, mode);
  // add each activity to output array
  for (const a of g.content) {
    const out: OutputActivity = { id: a.activity.id };
    if (a.error) out.error = a.error;
    if (token_res && token_res.tokenId) out.tokenId = token_res.tokenId; 
    output_array.push(out);
  }
}

// check if we are fetching an object from ipfs
if (fetchObjectPath) {
  // if also given tracking numbers, error out
  if (!privateKey) {
    throw new Error('A privatekey is required, specify one with -pk <privatekey.pem>');
  }

  const filename = fetchObjectPath
  downloadFileEncrypted(filename, privateKey).then((res) => {
    if (res) {
      // binary works the same as 'utf8' here
      // TODO: need a way to save the extension so files can be opened
      const dirs = filename.split(sep);
      if (dirs.length > 1) {
        for (let i = 0; i < dirs.length-1; i++) {
          mkdirSync(dirs[i]);
        }
      }
      writeFileSync(filename, res, 'binary');
      const h = hash_content(res);
      console.log(`HASH: ${h.type}:${h.value}`);
      console.log(`File saved: ${filename}`);
    }
  });
} else {
  if (processrequests) {
    process_emissions_requests();
  } else {
    if (!source) {
      if(!generatedKeypairs.length) {
        console.error('No input file given to process.');
        print_usage();
      } else {
        console.log('Keypairs generated: ');
        for (const k of generatedKeypairs) {
          console.log(`  ${k}-public.pem and ${k}-private.pem`);
        }
      }
      process.exit();
    }
    // the input JSON coming from STDIN or from a filename given as parameter
    const data_raw = readFileSync(source, 'utf8');
    const data = JSON.parse(data_raw);

    if (!publicKeys.length && !pretend && !queue) {
      throw new Error('No publickey was given for encryption, specify at least one with the -pubk <public.pem> argument.');
    }

    process_activities(data.activities).then(async (activities)=>{
      // group the resulting emissions per activity type, and for shipment type group by mode:
      const grouped_by_type = group_processed_activities(activities);
      if (pretend) {
        return grouped_by_type;
      }
      // now we can emit the tokens for each group and prepare the relevant data for final output
      const output_array: OutputActivity[] = [];
      for (const t in grouped_by_type) {
        if (t === 'shipment') {
          const group = grouped_by_type[t] as GroupedResults;
          for (const mode in group) {
            const doc = group[mode] as GroupedResult;
            await process_group(output_array, doc, t, publicKeys, mode);
          }
        } else {
          const doc = grouped_by_type[t] as GroupedResult;
          await process_group(output_array, doc, t, publicKeys);
        }
      }
      // add back any errors we filtered before to the output
      grouped_by_type.errors = activities.filter(a=>a.error);
      if (verbose) return grouped_by_type;
      // short form output: return an Array of objects with {id, tokenId, error }
      for (const a of activities.filter(a=>a.error)) {
        output_array.push({id: a.activity.id, error: a.error});
      }
      return output_array;
    }).then((output)=>{
      console.log(JSON.stringify(output, null, 4));
        process.exit(0)
    });
  }
}

