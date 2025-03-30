import { useState } from "react";
import { useLocation } from "wouter";
import IssueSubmissionModal from "@/components/IssueSubmissionModal";
import CameraPromptModal from "@/components/CameraPromptModal";

export default function IssueSubmissionForm() {
  const [showCameraPrompt, setShowCameraPrompt] = useState(true);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [, navigate] = useLocation();

  // Handle camera capture from prompt
  const handleCameraCapture = (base64Image: string) => {
    setCapturedImage(base64Image);
    setShowCameraPrompt(false);
    setShowIssueModal(true);
  };

  // Handle camera prompt skip
  const handleSkipCamera = () => {
    setShowCameraPrompt(false);
    setShowIssueModal(true);
  };

  // Handle camera prompt close (user clicked outside modal)
  const handleCameraPromptClose = () => {
    navigate("/");
  };

  // When issue modal is closed, redirect back to community board
  const handleIssueModalClose = () => {
    setShowIssueModal(false);
    navigate("/");
  };

  return (
    <>
      <CameraPromptModal 
        isOpen={showCameraPrompt} 
        onClose={handleCameraPromptClose}
        onCameraCapture={handleCameraCapture}
        onSkip={handleSkipCamera}
      />
      
      <IssueSubmissionModal 
        isOpen={showIssueModal} 
        onClose={handleIssueModalClose}
        initialPhotoData={capturedImage}
      />
    </>
  );
}
