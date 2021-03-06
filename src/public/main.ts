(() => {
let name: string;
let connectedUser: string;
const connection : WebSocket= new WebSocket('ws://localhost:8888');
const { METHOD_NAME } = require('../shared/common_types');

connection.onopen = () => {
  console.log("Connected");
};

// Handle all messages through this callback
connection.onmessage = (message) => {
  console.log("Got message", message.data);

  const data = JSON.parse(message.data);

  switch(data.type) {
    case METHOD_NAME.Login:
      onLogin(data.success);
      break;
    case METHOD_NAME.Offer:
      onOffer(data.offer, data.name);
      break;
    case METHOD_NAME.Answer:
      onAnswer(data.answer);
      break;
    case METHOD_NAME.Candidate:
      onCandidate(data.candidate);
      break;
    case METHOD_NAME.Leave:
      onLeave();
      break;
    default:
      break;
  }
};

connection.onerror = (err) => {
  console.log("Got error", err);
};

const isOpen = (connection : WebSocket) => { return connection.readyState === connection.OPEN };

// Alias for sending messages in JSON format
const send = (message : object) => {
  console.log(`send message: `);
  console.dir(message);
  if (connectedUser) {
    Object.assign(message, { name: connectedUser });
  }
  if (!isOpen(connection)) {
    console.log('---- WebSocket Connection is closed state!!!');
    return;
  } else {
    connection.send(JSON.stringify(message));
  }
}

const loginPage : any = document.querySelector('#login-page'),
    usernameInput : any = document.querySelector('#username'),
    loginButton : any = document.querySelector('#login'),
    callPage : any = document.querySelector('#call-page'),
    theirUsernameInput : any = document.querySelector('#their-username'),
    callButton : any = document.querySelector('#call'),
    hangUpButton : any = document.querySelector('#hang-up');

callPage.style.display = "none";

// Login when the user clicks the button
loginButton.addEventListener("click", (event : object) => {
  name = usernameInput.value;

  console.log(`loginButton click event name: ${name}`);

  if (name.length > 0) {
    send({
      type: METHOD_NAME.Login,
      name: name
    });
  }
});

const onLogin = (success : boolean) => {
  if (success === false) {
    alert("Login unsuccessful, please try a different name.");
  } else {
    loginPage.style.display = "none";
    callPage.style.display = "block";

    // Get the plumbing ready for a call
    startConnection();
  }
}

const yourVideo : any = document.querySelector('#yours'),
    theirVideo : any = document.querySelector('#theirs');
let yourConnection : RTCPeerConnection, stream : MediaStream;

const startConnection = () => {
  if (hasUserMedia()) {
    navigator.getUserMedia({ video: true, audio: true }, function (myStream) {
      stream = myStream;
      yourVideo.srcObject = stream;

      console.log(`startConnection()`);

      if (hasRTCPeerConnection()) {
        setupPeerConnection(stream);
      } else {
        alert("Sorry, your browser does not support WebRTC.");
      }
    }, function (error) {
      console.log(error);
    });
  } else {
    alert("Sorry, your browser does not support WebRTC.");
  }
}

const setupPeerConnection = (stream: MediaStream) => {
  const configuration = {'iceServers': [
      {'urls': 'stun:stun.services.mozilla.com'},
      {'urls': 'stun:stun.l.google.com:19302'}
    ]};
  yourConnection = new RTCPeerConnection(configuration);

  console.log(`setupPeerConnection()`);

  // Setup stream listening
  stream.getTracks().forEach((track : MediaStreamTrack) => {
    console.log("yourConnection.addTrack!");
    yourConnection.addTrack(track, stream);
  });
  yourConnection.ontrack = (event: any) => {
    console.log(`yourConnection.ontrack()`);
    theirVideo.srcObject = event.streams[0];
  };
  // Setup ice handling
  yourConnection.onicecandidate = (event : any) => {
    console.log(`yourConnection.onicecandidate`);
    if (event.candidate) {
      send({
        type: METHOD_NAME.Candidate,
        candidate: event.candidate
      });
    }
  };
}

const hasUserMedia = () => {
  navigator.getUserMedia = navigator.getUserMedia;
  return !!navigator.getUserMedia;
}

const hasRTCPeerConnection = () => {
  window.RTCPeerConnection = window.RTCPeerConnection;
  window.RTCSessionDescription = window.RTCSessionDescription;
  window.RTCIceCandidate = window.RTCIceCandidate;
  return !!window.RTCPeerConnection;
}

callButton.addEventListener("click", () => {
  const theirUsername = theirUsernameInput.value;
  console.log(`callButton.addEventListener()`);
  if (theirUsername.length > 0) {
    startPeerConnection(theirUsername);
  }
});

const startPeerConnection = async (user : string) => {
  connectedUser = user;
  console.log(`startPeerConnection()`);
  const offer: RTCSessionDescriptionInit = await yourConnection.createOffer();
  console.log(`yourConnection.createOffer()`);
  send({
    type: METHOD_NAME.Offer,
    offer: offer
  });
  yourConnection.setLocalDescription(offer);
  console.log(`yourConnection.setLocalDescription() - this is from yourConnection.createOffer()`);
}

const onOffer = async (offer : RTCSessionDescriptionInit, name : string) => {
  console.log(`onOffer()`);
  connectedUser = name;
  yourConnection.setRemoteDescription(new RTCSessionDescription(offer));
  const answer: RTCSessionDescriptionInit= await yourConnection.createAnswer();
  console.log(`yourConnection.createAnswer(), yourConnection.setLocalDescription()`);
  yourConnection.setLocalDescription(answer);
  send({
    type: METHOD_NAME.Answer,
    answer: answer
  });
}

const onAnswer = (answer: RTCSessionDescriptionInit) => {
  console.log(`onAnswer() - yourConnection.setRemoteDescription()`);
  yourConnection.setRemoteDescription(new RTCSessionDescription(answer));
}

const onCandidate = (candidate: any) => {
  console.log(`onCandidate() - yourConnection.addIceCandidate()`);
  yourConnection.addIceCandidate(new RTCIceCandidate(candidate));
}

hangUpButton.addEventListener("click", () => {
  console.log(`hangUpButton.addEventListener - leave`);
  send({
    type: METHOD_NAME.Leave
  });
  onLeave();
});

const onLeave = () => {
  console.log(`onLeave()`);
  connectedUser = null;
  theirVideo.srcObject = null;
  yourConnection.close();
  yourConnection.onicecandidate = null;
  yourConnection.ontrack = null;
  setupPeerConnection(stream);
}
})();