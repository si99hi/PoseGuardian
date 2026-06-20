import React, { useRef, useState } from 'react';

function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  
  // State for Angles
  const [leftAngle, setLeftAngle] = useState(0);
  const [rightAngle, setRightAngle] = useState(0);
  const [feedback, setFeedback] = useState('Select exercise, then click Start');
  const [isLoading, setIsLoading] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  
  // Exercise State: 'squat' or 'curl'
  const [exercise, setExercise] = useState('squat');

  // The angle calculation is the same, we just change which joints we look at!
  const calculateAngle = (a, b, c) => {
    const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let degrees = Math.abs(radians * 180.0 / Math.PI);
    if (degrees > 180) degrees = 360 - degrees;
    return degrees;
  };

  const sendToPython = async (angles) => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:8000/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exercise: exercise,
          left_angle: angles.left,
          right_angle: angles.right
        })
      });
      const result = await response.json();
      setFeedback(result.warning || 'Form looks good!');
      
      if (result.warning && result.warning !== 'Form looks good!') {
        const utterance = new SpeechSynthesisUtterance(result.warning);
        window.speechSynthesis.speak(utterance);
      }
    } catch (error) {
      setFeedback('⚠️ Backend offline. Run Python!');
    } finally {
      setIsLoading(false);
    }
  };

  const startCamera = async () => {
    setFeedback('Loading AI model...');
    setIsCameraReady(false);

    const Pose = window.Pose;
    const Camera = window.Camera;
    const { drawConnectors, drawLandmarks } = window;

    if (!Pose || !Camera) {
      setFeedback('❌ MediaPipe failed. Check Internet and refresh.');
      return;
    }

    const pose = new Pose({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
    });

    pose.setOptions({
      modelComplexity: 0,
      smoothLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    pose.onResults((results) => {
      const canvas = canvasRef.current;
      const canvasCtx = canvas.getContext('2d');
      canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

      if (results.poseLandmarks) {
        drawConnectors(canvasCtx, results.poseLandmarks, Pose.POSE_CONNECTIONS, { color: '#00FF00', lineWidth: 3 });
        drawLandmarks(canvasCtx, results.poseLandmarks, { color: '#FF0000', lineWidth: 2 });

        const lm = results.poseLandmarks;
        let lAngle = 0, rAngle = 0;

        // --- DYNAMIC ANGLE LOGIC ---
        if (exercise === 'squat') {
          // Legs: Hip (23/24) -> Knee (25/26) -> Ankle (27/28)
          lAngle = calculateAngle(lm[23], lm[25], lm[27]);
          rAngle = calculateAngle(lm[24], lm[26], lm[28]);
        } else if (exercise === 'curl' || exercise === 'shoulder_press') {
          // Arms: Shoulder (11/12) -> Elbow (13/14) -> Wrist (15/16)
          lAngle = calculateAngle(lm[11], lm[13], lm[15]);
          rAngle = calculateAngle(lm[12], lm[14], lm[16]);
        }

        setLeftAngle(lAngle);
        setRightAngle(rAngle);

        if (Math.floor(Date.now() / 300) % 2 === 0) {
          sendToPython({ left: lAngle, right: rAngle });
        }
      }
    });

    try {
      const camera = new Camera(videoRef.current, {
        onFrame: async () => {
          await pose.send({ image: videoRef.current });
        },
        width: 640,
        height: 480
      });
      await camera.start();
      setIsCameraReady(true);
      setFeedback(`✅ Tracking ${exercise}. Stand in front of the camera.`);
    } catch (err) {
      setFeedback('❌ Camera access denied.');
    }
  };

  // Helper to get the label for the angle
  const getAngleLabel = () => {
    if (exercise === 'squat') return 'Knee';
    if (exercise === 'curl' || exercise === 'shoulder_press') return 'Elbow';
    return 'Angle';
  };

  return (
    <div style={{ textAlign: 'center', padding: '15px', fontFamily: 'Arial, sans-serif' }}>
      <h1>🧘 PoseGuardian</h1>
      
      {/* Exercise Selector Dropdown */}
      <div style={{ marginBottom: '15px' }}>
        <label style={{ marginRight: '10px', fontWeight: 'bold' }}>Exercise: </label>
        <select 
          value={exercise} 
          onChange={(e) => setExercise(e.target.value)}
          style={{ padding: '8px 15px', fontSize: '1rem', borderRadius: '6px', border: '1px solid #ccc' }}
          disabled={isCameraReady} // Disable dropdown while camera is on
        >
          <option value="squat">🦵 Squat (Knees)</option>
          <option value="curl">💪 Bicep Curl (Elbows)</option>
          <option value="shoulder_press">🏋️ Shoulder Press (Elbows)</option>
        </select>
        {isCameraReady && <span style={{ marginLeft: '10px', color: '#888' }}>(Locked during session)</span>}
      </div>

      <div style={{ position: 'relative', display: 'inline-block', border: '3px solid #333', borderRadius: '12px' }}>
<video 
  ref={videoRef} 
  width="640" 
  height="480" 
  style={{ position: 'absolute', left: '-9999px', top: '-9999px' }} 
/> 

       <canvas ref={canvasRef} width="640" height="480" style={{ width: '100%', height: 'auto', borderRadius: '10px', backgroundColor: '#1a1a2e' }} />
      
      {!isCameraReady && (
        <button 
          onClick={startCamera}
          style={{ padding: '15px 40px', fontSize: '1.2rem', borderRadius: '10px', border: 'none', background: '#28a745', color: 'white', cursor: 'pointer', marginTop: '15px', fontWeight: 'bold' }}
        >
          🎥 Start Camera
        </button>
      )}

      {/* Dynamic Angle Display */}
      <div style={{ marginTop: '15px', display: 'flex', justifyContent: 'center', gap: '40px' }}>
        <p>Left {getAngleLabel()}: <strong>{leftAngle.toFixed(1)}°</strong></p>
        <p>Right {getAngleLabel()}: <strong>{rightAngle.toFixed(1)}°</strong></p>
      </div>
      
      <div style={{ 
        padding: '15px', 
        background: feedback.includes('STOP') ? '#ff4444' : feedback.includes('offline') ? '#ffaa00' : '#44bb44', 
        color: 'white', 
        borderRadius: '12px',
        fontSize: '1.2rem',
        fontWeight: 'bold',
        maxWidth: '600px',
        margin: '10px auto'
      }}>
        {feedback}
      </div>
    </div>
    </div>
    
  );
}

export default App;