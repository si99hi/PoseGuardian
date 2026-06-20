import React, { useEffect, useRef, useState } from 'react';
import { Pose } from '@mediapipe/pose';
import { Camera } from '@mediapipe/camera_utils';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';

function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [leftKneeAngle, setLeftKneeAngle] = useState(0);
  const [rightKneeAngle, setRightKneeAngle] = useState(0);
  const [feedback, setFeedback] = useState('Stand in front of camera...');
  const [isLoading, setIsLoading] = useState(false);

  // Calculate angle between 3 points (Hip, Knee, Ankle)
  const calculateAngle = (a, b, c) => {
    const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let degrees = Math.abs(radians * 180.0 / Math.PI);
    if (degrees > 180) degrees = 360 - degrees;
    return degrees;
  };

  // Send pose data to Python backend
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
      
      // Speak the warning aloud (free browser TTS)
      if (result.warning && result.warning !== 'Form looks good!') {
        const utterance = new SpeechSynthesisUtterance(result.warning);
        window.speechSynthesis.speak(utterance);
      }
    } catch (error) {
      console.error('Python backend not running?', error);
      setFeedback('⚠️ Backend offline. Run Python!');
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize MediaPipe
  useEffect(() => {
    const pose = new Pose({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
    });

    pose.setOptions({
      modelComplexity: 0, // 0 = fastest, best for old laptops
      smoothLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    pose.onResults((results) => {
      const canvas = canvasRef.current;
      const canvasCtx = canvas.getContext('2d');
      canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

      if (results.poseLandmarks) {
        // Draw the skeleton
        drawConnectors(canvasCtx, results.poseLandmarks, Pose.POSE_CONNECTIONS, { color: '#00FF00', lineWidth: 3 });
        drawLandmarks(canvasCtx, results.poseLandmarks, { color: '#FF0000', lineWidth: 2 });

        // Extract knee angles
        const lm = results.poseLandmarks;
        const lAngle = calculateAngle(lm[23], lm[25], lm[27]); // Hip, Knee, Ankle (Left)
        const rAngle = calculateAngle(lm[24], lm[26], lm[28]); // Hip, Knee, Ankle (Right)

        setLeftKneeAngle(lAngle);
        setRightKneeAngle(rAngle);

        // Send to Python every 300ms (throttled to save CPU)
        if (Math.floor(Date.now() / 300) % 2 === 0) {
          sendToPython({ leftKnee: lAngle, rightKnee: rAngle });
        }
      }
    });

    // Start webcam
    const camera = new Camera(videoRef.current, {
      onFrame: async () => {
        await pose.send({ image: videoRef.current });
      },
      width: 640,
      height: 480
    });
    camera.start();

    return () => camera.stop();
  }, []);

  return (
    <div style={{ textAlign: 'center', padding: '15px', fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ marginBottom: '5px' }}>🧘 PoseGuardian</h1>
      <p style={{ marginTop: '0', color: '#666' }}>AI Coach with Memory</p>
      
      <div style={{ position: 'relative', display: 'inline-block', border: '3px solid #333', borderRadius: '12px' }}>
        <video ref={videoRef} style={{ width: '640px', height: '480px', display: 'none' }} />
        <canvas ref={canvasRef} width="640" height="480" style={{ width: '100%', height: 'auto', borderRadius: '10px' }} />
      </div>
      
      <div style={{ marginTop: '15px', display: 'flex', justifyContent: 'center', gap: '30px' }}>
        <p>Left Knee: <strong>{leftKneeAngle.toFixed(1)}°</strong></p>
        <p>Right Knee: <strong>{rightKneeAngle.toFixed(1)}°</strong></p>
      </div>
      
      <div style={{ 
        padding: '15px', 
        background: feedback.includes('STOP') ? '#ff4444' : feedback.includes('offline') ? '#ffaa00' : '#44bb44', 
        color: 'white', 
        borderRadius: '12px',
        fontSize: '1.4rem',
        fontWeight: 'bold',
        maxWidth: '600px',
        margin: '10px auto'
      }}>
        {feedback}
      </div>
      
      <button 
        onClick={() => window.speechSynthesis.speak(new SpeechSynthesisUtterance('Checking your form now'))}
        style={{ padding: '10px 25px', fontSize: '1rem', borderRadius: '8px', border: 'none', background: '#007bff', color: 'white', cursor: 'pointer' }}
      >
        🔊 Test Voice
      </button>
    </div>
  );
}

export default App;