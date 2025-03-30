import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Camera, Upload, XCircle, ArrowRight } from "lucide-react";

interface CameraPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCameraCapture: (base64Image: string) => void;
  onSkip: () => void;
}

export default function CameraPromptModal({ 
  isOpen, 
  onClose, 
  onCameraCapture, 
  onSkip 
}: CameraPromptModalProps) {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState(false);

  // Start the camera stream
  const startCamera = async () => {
    setCameraError(false);
    try {
      // Request camera access
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment', 
          width: { ideal: 1280 },
          height: { ideal: 720 } 
        } 
      });
      
      setStream(mediaStream);
      setIsCapturing(true);
      
      // Connect stream to video element
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      setCameraError(true);
      toast({
        variant: "destructive",
        title: "Camera Access Error",
        description: "We couldn't access your camera. Please check permissions or try uploading a photo instead.",
      });
    }
  };

  // Stop the camera stream
  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsCapturing(false);
  };

  // Handle dialog close
  const handleClose = () => {
    stopCamera();
    onClose();
  };

  // Handle capture button click
  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Draw video frame to canvas
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convert canvas to base64 image data
        const base64Image = canvas.toDataURL('image/jpeg');
        
        // Stop camera and pass the image data to parent
        stopCamera();
        onCameraCapture(base64Image);
      }
    }
  };

  // Handle file upload
  const handleFileUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Handle file change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Check file size (limit to 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: "File too large",
        description: "Please upload an image smaller than 5MB.",
      });
      return;
    }
    
    // Check file type
    if (!file.type.startsWith("image/")) {
      toast({
        variant: "destructive",
        title: "Invalid file type",
        description: "Please upload an image file (JPG, PNG, etc).",
      });
      return;
    }
    
    // Read the file and convert to base64
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64String = event.target?.result as string;
      onCameraCapture(base64String);
    };
    
    reader.readAsDataURL(file);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Add a Photo (Recommended)</DialogTitle>
          <DialogDescription>
            Take a photo of the issue to help officials understand the problem better.
            Photos are also analyzed automatically to help categorize the issue.
          </DialogDescription>
        </DialogHeader>
        
        {isCapturing ? (
          // Camera view
          <div className="space-y-4">
            <div className="relative rounded-md overflow-hidden bg-black aspect-video flex items-center justify-center">
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline
                className="w-full h-full object-cover"
              />
              
              {/* Hidden canvas for capturing */}
              <canvas ref={canvasRef} className="hidden" />
              
              {/* Capture button */}
              <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                <Button 
                  variant="default" 
                  size="lg"
                  className="rounded-full h-14 w-14 p-0 bg-white/80 hover:bg-white border-2 border-primary"
                  onClick={capturePhoto}
                >
                  <div className="h-8 w-8 rounded-full border-2 border-primary"></div>
                </Button>
              </div>
              
              {/* Close camera button */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 text-white bg-black/50 hover:bg-black/70 rounded-full"
                onClick={stopCamera}
              >
                <XCircle className="h-6 w-6" />
              </Button>
            </div>
            
            <div className="text-center text-sm text-gray-500">
              Position the issue in frame and tap the capture button
            </div>
          </div>
        ) : (
          // Camera options
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            <Button
              variant="outline"
              className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-gray-300 hover:border-gray-400 gap-2 transition-colors"
              onClick={startCamera}
              disabled={cameraError}
            >
              <Camera className="h-8 w-8 text-primary" />
              <div className="text-sm font-medium">Take a Photo</div>
              <div className="text-xs text-gray-500">Use your device camera</div>
            </Button>
            
            <Button
              variant="outline"
              className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-gray-300 hover:border-gray-400 gap-2 transition-colors"
              onClick={handleFileUpload}
            >
              <Upload className="h-8 w-8 text-primary" />
              <div className="text-sm font-medium">Upload a Photo</div>
              <div className="text-xs text-gray-500">Choose from your device</div>
              
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </Button>
          </div>
        )}
        
        <div className="flex justify-between pt-4 border-t">
          <Button
            variant="ghost"
            onClick={onSkip}
          >
            Skip for now
          </Button>
          
          <Button
            variant="default"
            className="flex items-center gap-1"
            onClick={onSkip}
          >
            Continue without photo <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}