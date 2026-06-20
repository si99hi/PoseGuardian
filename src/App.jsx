import React, { useRef, useState } from 'react';

function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [leftKneeAngle, setLeftKneeAngle] = useState(0);
  const [rightKneeAngle, setRightKneeAngle] = useState(0);
  const [feedback, setFeedback] = useState('Click "Start Camera" to begin');
  const [isLoading, setIsLoading] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);

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
          left_knee: angles.leftKnee,
          right_knee: angles.rightKnee,
          rep_count: 0
        })
      });
      const result = await response.json();
      setFeedback(result.warning || 'Form looks good!');
      
      if (result.warning && result.warning !== 'Form looks good!') {
        const utterance = new SpeechSynthesisUtterance(result.warning);
        window.speechSynthesis.speak(utterance);
      }
    } catch (error) {
      console.error('Python backend not running:', error);
      setFeedback('⚠️ Backend offline. Run Python!');
    } finally {
      setIsLoading(false);
    }
  };

  const startCamera = async () => {
    setFeedback('Starting camera...');
    setIsCameraReady(false);

    // Access MediaPipe from the global window object (loaded via CDN in index.html)
    const Pose = window.Pose;
    const Camera = window.Camera;
    const { drawConnectors, drawLandmarks } = window;

    if (!Pose || !Camera) {
      setFeedback('❌ MediaPipe failed to load. Check your internet connection and refresh.');
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
        const lAngle = calculateAngle(lm[23], lm[25], lm[27]);
        const rAngle = calculateAngle(lm[24], lm[26], lm[28]);

        setLeftKneeAngle(lAngle);
        setRightKneeAngle(rAngle);

        if (Math.floor(Date.now() / 300) % 2 === 0) {
          sendToPython({ leftKnee: lAngle, rightKnee: rAngle });
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
      setFeedback('✅ Camera is live! Stand in front of it.');
    } catch (err) {
      console.error('Camera error:', err);
      setFeedback('❌ Cannot access camera. Check permissions.');
    }
  };

  return (
    <div style={{ textAlign: 'center', padding: '15px', fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ marginBottom: '5px' }}>🧘 PoseGuardian</h1>
      <p style={{ marginTop: '0', color: '#666' }}>AI Coach with Memory</p>
      
      <div style={{ position: 'relative', display: 'inline-block', border: '3px solid #333', borderRadius: '12px' }}>
        <video ref={videoRef} style={{ width: '640px', height: '480px', display: 'none' }} />
        <canvas ref={canvasRef} width="640" height="480" style={{ width: '100%', height: 'auto', borderRadius: '10px' }} />
      </div>
      
      {!isCameraReady && (
        <button 
          onClick={startCamera}
          style={{ 
            padding: '15px 40px', 
            fontSize: '1.2rem', 
            borderRadius: '10px', 
            border: 'none', 
            background: '#28a745', 
            color: 'white', 
            cursor: 'pointer',
            marginTop: '15px',
            fontWeight: 'bold'
          }}
        >
          🎥 Start Camera
        </button>
      )}

      <div style={{ marginTop: '15px', display: 'flex', justifyContent: 'center', gap: '30px' }}>
        <p>Left Knee: <strong>{leftKneeAngle.toFixed(1)}°</strong></p>
        <p>Right Knee: <strong>{rightKneeAngle.toFixed(1)}°</strong></p>
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
  );
}

export default App;