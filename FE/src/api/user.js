import { localAxios } from "@/util/http-commons";
import { useUserStore } from "@/store/userStore";

const local = localAxios();

async function userConfirm(param, success, fail) {
  await local.post(`/auth/login`, param).then(success).catch(fail);
}

async function userDoJoin(param, success, fail) {
  await local.post(`/user/join`, param).then(success).catch(fail);
}

async function findByToken(success, fail) {
  local.defaults.headers["Authorization"] =
    "Bearer " + useUserStore().accessToken;
  await local.get(`/user/info`).then(success).catch(fail);
}

async function tokenRegeneration(success, fail) {
  local.defaults.headers["Authorization"] =
    "Bearer " + useUserStore().accessToken;
  local.defaults.headers["refreshToken"] = useUserStore().refreshToken;
  await local.post().then(success).catch(fail);
}
// 로그아웃
async function logout(userid, success, fail) {
  await local.get(`/user/logout/${userid}`).then(success).catch(fail);
}
// 이메일 중복 체크
async function emailCheck(param, success, fail) {
  console.log(param);
  await local.post(`/user/email/${param}`).then(success).catch(fail);
}
// 패스워드 중복 체크
async function nickCheck(param, success, fail) {
  await local.get(`/user/nickname/${param}`).then(success).catch(fail);
}

// 이메일 인증 요청
async function emailVeificationRequest(param, success, fail) {
  await local.post(`/user/emails/verification-requests?email=${param}`).then(success).catch(fail);
}

// 이메일 인증 코드 확인
async function emailVeification(param, success, fail) {
  await local.get(`/user/emails/verifications?email=${param.email}&code=${param.code}`).then(success).catch(fail);
}

export {
  userConfirm,
  userDoJoin,
  findByToken,
  tokenRegeneration,
  logout,
  emailCheck,
  nickCheck,
  emailVeificationRequest,
  emailVeification,
};
