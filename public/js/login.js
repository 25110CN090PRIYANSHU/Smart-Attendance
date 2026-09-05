let pending2FA=null;
async function login(){
 const email=document.getElementById("email").value.trim(),password=document.getElementById("password").value,message=document.getElementById("message");
 if(!email||!password){message.innerText="Please enter email and password.";return;}
 try{const response=await fetch("/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password})});const data=await response.json().catch(()=>({}));if(!response.ok){message.innerText=data.message||"Login failed";return;}
 if(data.requires2FA){pending2FA={challengeToken:data.challengeToken};window._dev2FACode=data.devCode||null;document.getElementById('twoFactorModal').hidden=false;document.getElementById('twoFactorCode').focus();if(data.devCode)document.getElementById('twoFactorMessage').innerText=`Development code: ${data.devCode}`;return;}
 completeLogin(data);
 }catch(error){console.error(error);message.innerText="Server connection failed. Start the backend and try again.";}}
function completeLogin(data){localStorage.setItem("token",data.token);localStorage.setItem("user",JSON.stringify(data.user));window.location.href=data.user.role==="admin"?"admin.html":data.user.role==="teacher"?"teacher.html":"student.html";}
async function verify2FA(){const code=document.getElementById('twoFactorCode').value.trim();if(!pending2FA)return;try{const r=await fetch('/api/auth/verify-2fa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({challengeToken:pending2FA.challengeToken,code})});const d=await r.json().catch(()=>({}));if(!r.ok){document.getElementById('twoFactorMessage').innerText=d.message||'Verification failed';return;}completeLogin(d)}catch(e){document.getElementById('twoFactorMessage').innerText='Unable to verify code.'}}
function close2FA(){pending2FA=null;document.getElementById('twoFactorModal').hidden=true}
window.verify2FA=verify2FA;window.close2FA=close2FA;
async function forgotPassword(){const email=document.getElementById("email").value.trim();const message=document.getElementById("message");if(!email){message.innerText="Enter your email first, then click Forgot password.";return;}try{const r=await fetch("/api/auth/forgot-password",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email})});const d=await r.json().catch(()=>({}));message.innerText=d.devResetLink?`${d.message} Development reset link: ${d.devResetLink}`:d.message||"Check your email for reset instructions.";}catch(e){message.innerText="Unable to start password reset.";}}
function togglePassword(){const input=document.getElementById("password"),btn=document.getElementById("passwordToggle");input.type=input.type==="password"?"text":"password";btn.textContent=input.type==="password"?"👁️":"🙈";}
