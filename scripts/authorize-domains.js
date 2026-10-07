// Run only in GitHub Actions using its service-account credential file.
// Add our app origins without removing existing authorized domains.
import { GoogleAuth } from 'google-auth-library';
const auth=new GoogleAuth({scopes:['https://www.googleapis.com/auth/cloud-platform']});
const client=await auth.getClient();
const url='https://identitytoolkit.googleapis.com/admin/v2/projects/nickel-64/config';
const {data}=await client.request({url});
const authorizedDomains=[...new Set([...(data.authorizedDomains||[]),'localhost','nickel-64.firebaseapp.com','nickel-64.web.app','n64-songbook.anid4u2c.chatgpt.site'])];
await client.request({url:url+'?updateMask=authorizedDomains',method:'PATCH',data:{authorizedDomains}});
console.log('Authorized domains configured for Firebase and ChatGPT Sites.');
