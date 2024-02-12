/* 라이브러리 사용 */
import { Client } from "@stomp/stompjs";

/* LocalStorage 사용 */
import { useUserStore } from "@/store/userStore";
import { useRoomStore } from "@/store/roomStore";
import { usePickStore } from "@/store/pickStore";

/* .env 저장 주소 사용 */
const { VITE_WSS_API_URL } = import.meta.env;

/* 웹 소켓 연결을 위한 변수 */
let stompClient = null;
let connected = false;
let roomCode = null;

/* 게임 소켓 */
export function connect(accessToken, recvCallback) {
  return new Promise((resolve, reject) => {
    let token = accessToken;
    stompClient = new Client({
      brokerURL: "ws://192.168.100.99:8080/api/v1/connect",

      connectHeaders: {
        Authorization: `Bearer ${token}`,
      },

      beforeConnect: () => {},

      onConnect: () => {
        resolve();
        // 여기에서 구독 설정
        stompClient.subscribe("/sub/game/80ba0a", (message) => {
          // console.log("메시지 받음:", message.body);
          recvCallback(JSON.parse(message.body));
        });
      },

      /* 연결이 끊어지면 값 초기화 */
      onDisconnect: () => {
        stompClient = null;
        connected = false;
      },

      onWebSocketClose: (closeEvent) => {
        connected = false;
        console.log("WebSocket closed", closeEvent);
      },

      onWebSocketError: (error) => {
        connected = false;
        console.log("WebSocket error: ", error);
        reject(error);
      },

      // STOMP 수준의 오류 처리
      onStompError: (frame) => {
        connected = false;
        console.error("[roomStore] : STOMP 오류 발생");
        reject(new Error("STOMP error"));
        alert("소켓이 끊어졌습니다.");
      },
      reconnectDelay: 5000, //자동재연결
    });

    try {
      stompClient.activate();
      connected = true;
      // this.socketSend("/pub/game/b2bc27/start","start");
      console.log("연결 성공");
    } catch (error) {
      connected = false;
      console.log("소켓 에러: " + error);
    }
  });
}

/*
 * 방, 픽창을 위한 소켓
 *
 * 방 또는 픽창에서 방을 구독을 위해 사용한다.
 */
export function connectRoom(type, router, from) {
  return new Promise((resolve, reject) => {
    let token = useUserStore().accessToken;
    console.log(router);

    stompClient = new Client({
      brokerURL: VITE_WSS_API_URL,

      connectHeaders: {
        Authorization: `Bearer ${token}`,
      },

      beforeConnect: () => {},

      onConnect: () => {
        console.log("[socket.onConnect] : 연결 실행합니다.");

        if (type === "Room") {
          // 구독한다
          initRoom(router, from);
          resolve();
        } else if (type === "Pick") {
          initPick(router, from);
          resolve();
        }
      },

      /*
       * 연결이 끊김
       *
       * 자동으로 연결이 끊어진다.
       *
       * 여기서 값을 초기화를 할지 정해야 한다.
       */
      onDisconnect: () => {
        console.log("[socket.onDisconnect] : 연결이 끊어졌습니다.");
        // stompClient = null
        // connected = false;
        // useUserStore().initData();
      },

      onWebSocketClose: (closeEvent) => {
        console.log("[socket.onWebSocketClose] : 연결이 끊어졌습니다.");
        console.log("상세 에러 : " + closeEvent);
      },

      /*
       * 웹 소켓 에러
       *
       * 이 부분은 에러가 발생하면 모든 값 초기화 후 초기화면으로 이동한다.
       */
      onWebSocketError: (error) => {
        fatalError("[socket.onWebSocketError] : 웹 소켓 에러", error);
        alert("세션이 끊어짐");
        router.push("/");
        reject(new Error("WebSocket error"));
      },

      /*
       * STOMP 에러
       *
       * 이 부분은 에러가 발생하면 모든 값 초기화 후 초기화면으로 이동합니다.
       */
      onStompError: (frame) => {
        fatalError("[roomStore] : STOMP 오류 발생", frame);
        reject(new Error("STOMP error"));
        alert("세션이 끊어짐");
        router.push("/");
      },

      reconnectDelay: 5000, //자동재연결
    });

    // 여기서 소켓을 시작한다.
    try {
      if (from === "make") {
        roomCode = useRoomStore().createRoomInfo.roomCode;
      } else if (from === "enter") {
        roomCode = useUserStore().roomCode;
      }

      stompClient.activate();
      connected = true;
      console.log("[socket] : activate() 성공");
    } catch (error) {
      connected = false;
      console.log("[socket] : activate() 시도 중 에러");
      console.log("상세 에러 : " + error);
    }
  });
}

/*
 * 방 구독 함수
 *
 * 방과 관련된 정보를 수신하는 함수이다.
 *
 * router : 해당 vue 라우터 변수
 * from : 방 생성인지 그냥 참여하는지 확인하는 변수
 */
export function initRoom(router, from) {
  // 먼저, create된 roomCode를 가져와서 방 구독
  useRoomStore().subscription.room = stompClient.subscribe(
    "/sub/room/" + roomCode,

    // 구독 메시지 이벤트 처리
    (message) => {
      console.log(message.body);
      useRoomStore().receivedMessage = JSON.parse(message.body);

      // (경우1) 입장 정보 타입
      if (useRoomStore().receivedMessage.type === "ROOM_ENTER_INFO") {
        useRoomStore().roomChatMessages.push(
          useRoomStore().receivedMessage.data.message
        );

        useRoomStore().receivedMessage.data.currentSeatDtoList.forEach(
          (seat, index) => {
            const seatKey = `seatnum${index + 1}`;
            if (useRoomStore().seatInfo[seatKey]) {
              useRoomStore().seatInfo[seatKey].nickname = seat.nickname
                ? seat.nickname
                : "";
              useRoomStore().seatInfo[seatKey].ready = seat.ready;
              useRoomStore().seatInfo[seatKey].state = seat.state;
              useRoomStore().seatInfo[seatKey].team = seat.team;
            }
          }

          // useRoomStore().receivedMessage.data.roomDetailDto.currentUserCount;
        );

        const storedRoomData = JSON.parse(localStorage.getItem("room"));

        const updatedRoomData = {
          ...storedRoomData,
          seatInfo: {
            ...useRoomStore().seatInfo,
          },

          roomChatMessages: {
            ...useRoomStore().roomChatMessages,
          },
        };

        // 로컬 스토리지에 업데이트된 데이터 저장
        localStorage.setItem("room", JSON.stringify(updatedRoomData));

        // 방 생성 처리라면 push 필요
        if (from === "make") {
          // 방 생성 모달 닫기
          useRoomStore().showRoomMakingModal = false;

          router.push({ name: "wait" });
        }
      } else if (useRoomStore().receivedMessage.type === "ROOM_EXIT_INFO") {
        // 방장이 방을 삭제한 경우 모두 alert를 받고 나간다.
        console.log(useRoomStore().receivedMessage.data.message);
        if (
          useRoomStore().receivedMessage.data.message.includes(
            "삭제되었습니다."
          )
        ) {
          alert("방장이 방을 나갔습니다.");

          // 구독 취소한 뒤 방 정보에 대해 모두 리셋한다.
          useRoomStore().subscription.room.unsubscribe();
          // const initialStateRoom = useRoomStore().$reset();
          // Object.assign(this, initialStateRoom);
          router.push({ name: "room" });
        } else {
          useRoomStore().roomChatMessages.push(
            useRoomStore().receivedMessage.data.message
          );
          useRoomStore().receivedMessage.data.currentSeatDtoList.forEach(
            (seat, index) => {
              const seatKey = `seatnum${index + 1}`;
              if (useRoomStore().seatInfo[seatKey]) {
                useRoomStore().seatInfo[seatKey].nickname = seat.nickname;
                useRoomStore().seatInfo[seatKey].ready = seat.ready;
                useRoomStore().seatInfo[seatKey].state = seat.state;
                useRoomStore().seatInfo[seatKey].team = seat.team;
              }
            }
          );
        }
      } else if (useRoomStore().receivedMessage.type === "ROOM_READY") {
        useRoomStore().receivedMessage.data.forEach((seat, index) => {
          const seatKey = `seatnum${index + 1}`;
          if (useRoomStore().seatInfo[seatKey]) {
            useRoomStore().seatInfo[seatKey].nickname = seat.nickname;
            useRoomStore().seatInfo[seatKey].ready = seat.ready;
            useRoomStore().seatInfo[seatKey].state = seat.state;
            useRoomStore().seatInfo[seatKey].team = seat.team;
          }
        });
      }
      // 방장이 게임을 시작을 눌렀을 경우
      else if (useRoomStore().receivedMessage.type === "ROOM_START_PICK") {
        // Room에 대한 구독 취소 생각해보기.
        console.log("방장이 게임 시작을 눌렀습니다!!");

        /* 자신의 자리 번호 */
        // (1~3) red, (4~6) blue
        let myTeamName = null;
        let isOwner = false;

        const seatInfo = useRoomStore().seatInfo;
        const seatKeys = Object.keys(seatInfo);

        // (임시)
        // 자신의 팀 번호 확인
        for (let i = 0; i < seatKeys.length; i++) {
          const seatKey = seatKeys[i];
          if (seatInfo[seatKey].nickname === useUserStore().userInfo.nickname) {
            // 자신이 방장인지 확인
            if (seatInfo[seatKey].state === 2) {
              isOwner = true;
            }

            // 팀 이름 결정
            if (seatInfo[seatKey].team === 1) {
              myTeamName = "red";
            } else {
              myTeamName = "blue";
            }
            break;
          }
        }

        // 소켓을 이제 Pick 타입으로 전환
        // 구독이 완료가 되면, 이제 픽창으로 시작
        connectRoom("Pick", router, myTeamName).then(() => {
          // 여기서는 유닛 정보, 사용자 픽 정보를 초기화로 받는다.
          // (방장만 하면 됨.)
          if (isOwner) {
            console.log("방장이 게임 정보를 뿌렸습니다.");

            pubPick(
              "/pub/pick/" +
                useUserStore().currentRoomInfo.roomCode +
                "/get-pre-info"
            );
          }

          // 픽창으로 넘어가기.
          setTimeout(() => {
            router.push({ name: "pick" });
          }, 300);
        });
      }
      //
      else if (useRoomStore().receivedMessage.type === "ROOM_CHAT") {
        useRoomStore().roomChatMessages.push(
          useRoomStore().receivedMessage.data.nickname +
            " : " +
            useRoomStore().receivedMessage.data.message
        );

        const storedRoomData = JSON.parse(localStorage.getItem("room"));

        const updatedRoomData = {
          ...storedRoomData,
          roomChatMessages: {
            ...useRoomStore().roomChatMessages,
          },
        };

        // 로컬 스토리지에 업데이트된 데이터 저장
        localStorage.setItem("room", JSON.stringify(updatedRoomData));
      }
    }
  );
}

/*
 * 픽창 구독 함수
 *
 * 픽창과 관련된 정보를 수신한다.
 *
 * router : 해당 vue 라우터 변수
 * from : 자신의 팀 이름 변수
 */
export function initPick(router, from) {
  // 먼저, create된 roomCode를 가져와서 방 구독
  usePickStore().subscription.pick = stompClient.subscribe(
    "/sub/room/" + useUserStore().currentRoomInfo.roomCode + "/" + from,
    (message) => {
      console.log(message.body);
      usePickStore().receivedMessage = JSON.parse(message.body);

      /* 홍팀, 청팀 정보를 받아오는 것 */
      if (usePickStore().receivedMessage.type === "PICK_GET_PRE_INFO") {
        usePickStore().unitInfo = usePickStore().receivedMessage.data.unitInfo;
        usePickStore().userInfo = usePickStore().receivedMessage.data.userInfo;
      }
    }
  );
}

/*
 * 치명적 오류
 *
 * 여기서는 소켓을 모두 초기화하고 사용자 LocalStoage를 초기화 후
 * 초기 화면으로 이동하게 된다.
 */
function fatalError(error, msg) {
  stompClient = null;
  connected = false;
  useUserStore().initData();
  useRoomStore().stompClient.deactivate();
  console.log("[socket.fatalError] : " + error);
  console.log("상세 에러 : " + msg);
}

// 구독한 방에 알리기.
export function pubRoom(destination, email) {
  stompClient.publish({
    destination: destination,
    body: email,
  });
}

// 픽창 넘어가기 전 게임 정보 알리기.
export function pubPick(destination) {
  stompClient.publish({
    destination: destination,
  });
}

// 서버로 보내기.
export function socketSend(destination, msg) {
  console.log(destination);
  stompClient.publish({
    destination: destination,
    body: JSON.stringify(msg),
  });
}