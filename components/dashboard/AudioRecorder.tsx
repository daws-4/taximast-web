"use client";

import { useState, useRef, useEffect } from "react";

export interface AudioRecorderProps {
    onStop: (blob: Blob) => void;
    onCancel: () => void;
}

export default function AudioRecorder({ onStop, onCancel }: AudioRecorderProps) {
    const [recording, setRecording] = useState(false);
    const [duration, setDuration] = useState(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<BlobPart[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        startRecording();
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
                mediaRecorderRef.current.stop();
                mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
            }
        };
    }, []);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
            
            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: "audio/webm;codecs=opus" });
                chunksRef.current = [];
                // Stop all tracks to turn off the red recording light
                stream.getTracks().forEach(t => t.stop());
                
                // Only trigger onStop if we actually recorded something (duration > 0)
                if (timerRef.current) clearInterval(timerRef.current);
                setRecording(false);
                
                // We emit the blob upwards
                // The parent decides what to do with it
                onStop(blob);
            };

            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];
            mediaRecorder.start();
            setRecording(true);

            // Timer
            setDuration(0);
            timerRef.current = setInterval(() => {
                setDuration(prev => prev + 1);
            }, 1000);

        } catch (error) {
            console.error("Error accessing microphone:", error);
            onCancel(); 
        }
    };

    const handleStop = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
            mediaRecorderRef.current.stop();
        }
    };

    const handleCancel = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
            // we override onstop to do nothing, then stop and call onCancel
            mediaRecorderRef.current.onstop = () => {
                mediaRecorderRef.current?.stream.getTracks().forEach(t => t.stop());
                onCancel();
            };
            mediaRecorderRef.current.stop();
        } else {
            onCancel();
        }
        if (timerRef.current) clearInterval(timerRef.current);
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    return (
        <div className="flex-1 flex items-center justify-between px-3 py-1 bg-red-500/10 rounded-xl border border-red-500/30">
            <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-red-400 font-mono text-sm font-medium">
                    {formatTime(duration)}
                </span>
                <span className="text-xs text-red-400/60 font-medium">Grabando...</span>
            </div>
            
            <div className="flex items-center gap-1">
                <button
                    type="button"
                    onClick={handleCancel}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors text-red-400"
                    title="Cancelar"
                >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                </button>
                <button
                    type="button"
                    onClick={handleStop}
                    className="p-2 bg-red-500 hover:bg-red-600 rounded-full transition-colors text-white ml-2"
                    title="Enviar"
                >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12l5 5L20 7" />
                    </svg>
                </button>
            </div>
        </div>
    );
}
