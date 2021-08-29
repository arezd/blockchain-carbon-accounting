import { WebSocketClient, WebSocketClientOptions } from '../../src/web-socket/client';
import { WebSocketKey, WebSocketKeyOptions, IClientDigest, IClientCsrReq, } from '../../src/web-socket/key';
import { getSecWsKey } from '../../src/web-socket/identity';
import { expect } from 'chai';
import { createHash } from 'crypto';
import WebSocket, {WebSocketServer} from 'ws';
import { startServer, createFabricSocketClient } from "./webSocketTestUtils";

const port = 8500;
const testP256 = 'test-p256';
const testP384 = 'test-p384';
let server;
let fwsClient:WebSocketClient;
let fwsKey:WebSocketKey;
let fws:WebSocket;
let secWsKey;

describe('web-socket/key', () => {
  before (async () => {
    server = await startServer(port);
    const wss = new WebSocketServer({ server });
    wss.on('connection', async function connection(ws,request) {
      fws = ws;
      secWsKey = getSecWsKey(request);
    });
    const fwsClientOpts:WebSocketClientOptions = {
      host:`ws://localhost:${port}`,
      keyName: testP256, 
      curve:'p256',
      logLevel: 'error'
    }
    fwsClient = await createFabricSocketClient(fwsClientOpts);
  })
  after(async () => {
    await fwsClient.close();
    server.close();
  })    
  describe('constructor', async () => {
    it('should create a WebSocketKey instance', async() => { 
      fwsKey = new WebSocketKey({
        ws:fws, 
        secWsKey:secWsKey,
        pubKey: fwsClient.getPub(),
        curve: 'p256',
        logLevel: 'error' 
      });
    });
    it('throw if pubKey is empty', () => {
      const wskOpts:WebSocketKeyOptions = {
        ws:fws,
        secWsKey:secWsKey,
        pubKey:'', 
        curve: 'p384',
        keyName:testP256, 
        logLevel:'error',
      }
      expect(function () {
        new WebSocketKey(wskOpts);
      }).to.throw('pubKey pem should not be empty');
    });
    /*it('throw if secWsKey is empty', () => {
      const wskOpts:WebSocketKeyOptions = {
        ws:fws,
        secWsKey:'',
        pubKey:fwsClient.getPub(), 
        curve: 'p384',
        keyName:testP256, 
        logLevel:'error',
      }
      expect(function () {
        new WebSocketKey(wskOpts);
      }).to.throw('secWsKey should not be empty');
    });*/
  });
      
  describe('methods', () => {
    describe('sign', () => {
      const digest = Buffer.from('hello-secure-fabric');
      const hashedDigest = createHash('sha256').update(digest).digest();
      it('sign-with-p256', async () => {
        const args:IClientDigest = {digest,preHashed:false}
        const signature = await fwsKey.sign(args);
        expect(signature).not.to.be.undefined;
      });
      
      it('sign-with-hashed-message-p384', async () => {
        const args:IClientDigest = {digest,preHashed:false}
        await fwsClient.getKey({keyName: testP384});
        fwsKey = new WebSocketKey({
          ws:fws, 
          secWsKey,
          pubKey: fwsClient.getPub(),
          curve: 'p384',
          logLevel: 'error' 
        });
        const signature = await fwsKey.sign(args);
        expect(signature).not.to.be.undefined;
      });
    });
    describe('generateCSR', () => {
      it('for-p256', async () => {
        const args:IClientCsrReq = {commonName: 'user'}
        await fwsClient.getKey({keyName: testP384})
        fwsKey = new WebSocketKey({
          ws:fws,
          secWsKey,
          pubKey: fwsClient.getPub(),
          curve: 'p384',
          logLevel: 'error' 
        });
        const csr = await fwsKey.generateCSR(args);
        expect(csr).not.to.be.undefined;
      });
    });
  });
  
});