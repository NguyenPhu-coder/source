/**
 * Avatar 3D Viewer Component
 * Renders 3D avatar using Three.js and React Three Fiber
 */

import React, { useRef, useEffect, useState, Suspense } from 'react';
// import { Canvas, useFrame, useLoader } from '@react-three/fiber';
// import { OrbitControls, useGLTF, PerspectiveCamera, Environment } from '@react-three/drei';
import * as THREE from 'three';
import '../styles/Avatar3DViewer.css';

// Avatar Model Component
/*
function AvatarModel({ modelUrl, gesture, emotion }) {
    const groupRef = useRef();
    const { scene, animations } = useGLTF(modelUrl || '/avatars/default_teacher.glb', true);
    const [currentAnimation, setCurrentAnimation] = useState(null);

    useEffect(() => {
        if (animations && animations.length > 0 && gesture) {
            // Find animation for gesture
            const animation = animations.find(anim =>
                anim.name.toLowerCase().includes(gesture.toLowerCase())
            ) || animations[0];

            setCurrentAnimation(animation);
        }
    }, [gesture, animations]);

    // Rotate avatar slowly
    useFrame((state, delta) => {
        if (groupRef.current) {
            groupRef.current.rotation.y += delta * 0.1;
        }
    });

    return (
        <group ref={groupRef}>
            <primitive object={scene} scale={1.5} />
        </group>
    );
}
*/

// Loading fallback
function Loader() {
    return (
        <div className="w-full h-full flex items-center justify-center bg-gray-100">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
    );
}

// Main Avatar3DViewer Component
export function Avatar3DViewer({
    modelUrl,
    gesture = 'neutral',
    emotion = 'neutral',
    enableControls = true,
    backgroundColor = '#f5f7fa'
}) {
    const [error, setError] = useState(null);

    return (
        <div className="avatar-3d-viewer">
            {error ? (
                <div className="avatar-error">
                    <span className="error-icon">⚠️</span>
                    <p>{error}</p>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center w-full h-full bg-slate-100 rounded-xl border-2 border-dashed border-slate-300 p-8 text-center">
                    <div className="text-4xl mb-4">🤖</div>
                    <h3 className="text-xl font-bold text-slate-700 mb-2">3D Avatar Maintenance</h3>
                    <p className="text-muted-foreground text-sm max-w-xs">
                        Tính năng hiển thị 3D đang được bảo trì để nâng cấp hiệu suất. Vui lòng quay lại sau!
                    </p>
                </div>
            )}

            {/* Status Indicators */}
            <div className="avatar-status">
                <span className="status-badge gesture">
                    {gesture}
                </span>
                <span className="status-badge emotion">
                    {emotion}
                </span>
            </div>
        </div>
    );
}

// Preload default avatar model
// useGLTF.preload('/avatars/default_teacher.glb');

export default Avatar3DViewer;
