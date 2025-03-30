import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { IssueType, UrgencyLevel, EmailTemplate, Project } from "@/lib/types";
import MapComponent from "@/components/MapComponent";
import EmailPreviewModal from "@/components/EmailPreviewModal";
import SubmissionSuccessModal from "@/components/SubmissionSuccessModal";
import { Upload, Image, Camera, Loader2 } from "lucide-react";

interface IssueSubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPhotoData?: string | null;
}

// Steps in the submission process
type SubmissionStep = "details" | "email" | "success";

export default function IssueSubmissionModal({ isOpen, onClose, initialPhotoData }: IssueSubmissionModalProps) {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState<SubmissionStep>("details");
  const [submittedProject, setSubmittedProject] = useState<Project | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Form state
  // Define FormData type to include additional customization options with predefined options
  type FormDataType = {
    title: string;
    description: string;
    issueType: IssueType;
    location: string;
    latitude: string;
    longitude: string;
    urgencyLevel: UrgencyLevel;
    contactEmail: string;
    affectedGroups: string;
    desiredOutcome: string;
    impactLevel: string;
    photoData: string | null;
  };

  // Predefined options for dropdowns
  const TITLE_OPTIONS = [
    "Infrastructure Repair Needed",
    "Safety Concern",
    "Street Improvement Request",
    "Damaged Infrastructure",
    "Maintenance Request",
    "Accessibility Issue",
    "Pedestrian Safety Concern",
    "Traffic Hazard",
    "Community Improvement"
  ];
  
  const LOCATION_OPTIONS = [
    "Downtown Area",
    "Main Street",
    "Park Area",
    "Residential Neighborhood",
    "Commercial District",
    "School Zone",
    "Hospital Area",
    "Public Square",
    "Historic District",
    "Industrial Zone",
    "Highway Access"
  ];

  const AFFECTED_GROUPS_OPTIONS = [
    "Elderly Residents",
    "Children and Students",
    "People with Disabilities",
    "Local Businesses",
    "Pedestrians",
    "Cyclists",
    "Public Transit Users",
    "Motorists",
    "Nearby Residents",
    "Visitors and Tourists",
    "All Community Members"
  ];

  const IMPACT_LEVEL_OPTIONS = [
    "Minimal - Minor inconvenience",
    "Moderate - Daily disruption",
    "Significant - Safety risk",
    "Severe - Immediate danger",
    "Critical - Emergency situation"
  ];

  const DESIRED_OUTCOME_OPTIONS = [
    "Repair damaged infrastructure",
    "Install new safety feature",
    "Regular maintenance schedule",
    "Complete replacement/renovation",
    "Installation of accessibility features",
    "Traffic calming measures",
    "Better lighting for safety",
    "Addition of community amenities",
    "Remove hazardous conditions"
  ];

  const [formData, setFormData] = useState<FormDataType>({
    title: "",
    description: "",
    issueType: "" as IssueType,
    location: "",
    latitude: "32.8397", // Default to Imperial Valley, CA
    longitude: "-115.5663",
    urgencyLevel: "medium" as UrgencyLevel,
    contactEmail: "",
    affectedGroups: "",
    desiredOutcome: "",
    impactLevel: "",
    photoData: initialPhotoData || null,
  });
  
  // Photo analysis state
  const [isAnalyzingPhoto, setIsAnalyzingPhoto] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  
  // Email template state
  const [emailTemplate, setEmailTemplate] = useState<EmailTemplate>({
    emailBody: "",
    emailSubject: "",
    emailTo: "",
  });

  // Email tone state
  type EmailTone = "professional" | "formal" | "assertive" | "concerned" | "personal";
  const [currentTone, setCurrentTone] = useState<EmailTone>("professional");
  const [isChangingTone, setIsChangingTone] = useState(false);
  
  // Analyze initial photo if provided
  useEffect(() => {
    if (initialPhotoData) {
      toast({
        title: "Photo detected",
        description: "Analyzing your photo...",
      });
      analyzePhotoWithAI(initialPhotoData);
    }
  }, [initialPhotoData, toast]);
  
  // Function to get button style based on tone selection
  const getToneButtonStyle = (tone: EmailTone) => {
    if (tone === currentTone) {
      return "bg-primary text-white hover:bg-primary/90";
    }
    return "bg-gray-200 text-gray-700 hover:bg-gray-300";
  };
  
  // Handle email tone change
  const handleToneChange = async (tone: EmailTone) => {
    if (tone === currentTone || !emailTemplate.emailBody) return;
    
    setIsChangingTone(true);
    try {
      setCurrentTone(tone);
      
      const response = await fetch("/api/regenerate-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          emailBody: emailTemplate.emailBody,
          tone,
        }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to regenerate email");
      }
      
      const data = await response.json();
      setEmailTemplate(prev => ({
        ...prev,
        emailBody: data.emailBody
      }));
      
      // If there's a warning message but the operation still worked
      if (data.warning) {
        toast({
          variant: "default",
          title: "Tone Updated (Offline Mode)",
          description: data.warning,
        });
      } else {
        toast({
          title: "Tone Updated",
          description: `Email tone changed to ${tone}`,
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to adjust email tone. Please try again.",
      });
    } finally {
      setIsChangingTone(false);
    }
  };
  
  // Generate email mutation
  const generateEmailMutation = useMutation({
    mutationFn: async () => {
      // Include additional customization fields if they're filled in
      const payload = {
        issueType: formData.issueType,
        location: formData.location,
        description: formData.description,
        urgencyLevel: formData.urgencyLevel,
        // Include optional fields only if they have content
        ...(formData.affectedGroups ? { affectedGroups: formData.affectedGroups } : {}),
        ...(formData.desiredOutcome ? { desiredOutcome: formData.desiredOutcome } : {})
      };
      
      const response = await fetch("/api/generate-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to generate email");
      }
      
      return response.json() as Promise<EmailTemplate>;
    },
    onSuccess: (data) => {
      setEmailTemplate(data);
      setCurrentStep("email");
    },
  });
  
  // Create project mutation
  const createProjectMutation = useMutation({
    mutationFn: async () => {
      // First generate the final project submission
      const projectData = {
        ...formData,
        emailTemplate: emailTemplate.emailBody,
        emailSubject: emailTemplate.emailSubject,
        emailRecipient: emailTemplate.emailTo,
        contactEmail: formData.contactEmail || null,
      };
      
      const response = await apiRequest("POST", "/api/projects", projectData);
      return response.json() as Promise<Project>;
    },
    onSuccess: (data) => {
      setSubmittedProject(data);
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/activities'] });
      setCurrentStep("success");
    },
  });
  
  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };
  
  // Handle select changes
  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };
  
  // Handle location selection on the map
  const handleLocationSelect = (lat: string, lng: string) => {
    setFormData((prev) => ({ ...prev, latitude: lat, longitude: lng }));
  };
  
  // Handle photo upload button click
  const handlePhotoUploadClick = () => {
    // Trigger the hidden file input click
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  
  // Function to extract EXIF data from image
  const extractExifData = async (file: File): Promise<{ lat?: string; lng?: string }> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = function() {
        const result = reader.result as ArrayBuffer;
        // This is a simplified approach - in a production app, you'd use a proper EXIF library
        // For the demo, we'll just resolve with no coordinates
        resolve({});
      };
      reader.readAsArrayBuffer(file);
    });
  };

  // Function to analyze photo with OpenAI
  const analyzePhotoWithAI = async (base64Image: string) => {
    setIsAnalyzingPhoto(true);
    try {
      // Remove the data:image/jpeg;base64, prefix before sending
      const imageData = base64Image.split(',')[1];
      
      // Use apiRequest from queryClient instead of fetch
      const response = await apiRequest('POST', '/api/analyze-photo', { 
        photoData: imageData 
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API error response:', errorText);
        throw new Error(`Failed to analyze photo: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Photo analysis result:', data);
      
      // Update form with detected issue type if available
      if (data.issueType) {
        setFormData(prev => ({ 
          ...prev, 
          issueType: data.issueType 
        }));
        
        toast({
          title: "Photo Analysis Complete",
          description: `We've detected this issue as: ${data.issueType.replace(/^\w/, (c: string) => c.toUpperCase()).replace('_', ' ')}`,
        });
      } else {
        toast({
          variant: "default",
          title: "Photo Analysis",
          description: "Could not automatically detect the issue type. Please select it manually.",
        });
      }
    } catch (error) {
      console.error('Error analyzing photo:', error);
      toast({
        variant: "destructive",
        title: "Analysis Failed",
        description: "We couldn't analyze your photo. Please select the issue type manually.",
      });
    } finally {
      setIsAnalyzingPhoto(false);
    }
  };

  // Handle file input change
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
    
    // Try to extract location data from EXIF
    try {
      const exifData = await extractExifData(file);
      if (exifData.lat && exifData.lng) {
        // Make sure we have proper string values for lat/lng
        const latitude = String(exifData.lat);
        const longitude = String(exifData.lng);
        
        setFormData(prev => ({
          ...prev,
          latitude,
          longitude
        }));
        
        toast({
          title: "Location Detected",
          description: "Location data extracted from your photo.",
        });
      }
    } catch (error) {
      console.error("Failed to extract EXIF data:", error);
    }
    
    // Read the file and convert to base64
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64String = event.target?.result as string;
      setFormData((prev) => ({ ...prev, photoData: base64String }));
      
      toast({
        title: "Photo uploaded",
        description: "Your photo has been attached. Analyzing the image...",
      });
      
      // Analyze the photo using AI
      await analyzePhotoWithAI(base64String);
    };
    
    reader.readAsDataURL(file);
  };
  
  // Handle form submission to generate email
  const handleGenerateEmail = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    if (!formData.title || !formData.description || !formData.issueType || !formData.location) {
      toast({
        variant: "destructive",
        title: "Missing information",
        description: "Please fill out all required fields.",
      });
      return;
    }
    
    // Generate email
    generateEmailMutation.mutate();
  };
  
  // Handle back button
  const handleBackToDetails = () => {
    setCurrentStep("details");
  };
  
  // Handle send email
  const handleSendEmail = () => {
    createProjectMutation.mutate();
  };
  
  // Handle close modals and reset state
  const handleCloseAll = () => {
    setCurrentStep("details");
    setFormData({
      title: "",
      description: "",
      issueType: "" as IssueType,
      location: "",
      latitude: "32.8397", // Default to Imperial Valley, CA
      longitude: "-115.5663",
      urgencyLevel: "medium" as UrgencyLevel,
      contactEmail: "",
      affectedGroups: "",
      desiredOutcome: "",
      impactLevel: "",
      photoData: null,
    });
    setEmailTemplate({
      emailBody: "",
      emailSubject: "",
      emailTo: "",
    });
    setSubmittedProject(null);
    setCurrentTone("professional");
    onClose();
  };
  
  // Render the current step
  const renderStepContent = () => {
    switch (currentStep) {
      case "details":
        return (
          <form onSubmit={handleGenerateEmail} className="space-y-6">
            {/* Step indicator */}
            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 bg-primary text-white flex items-center justify-center rounded-full">1</div>
                  <span className="text-xs mt-1 text-gray-600">Issue Details</span>
                </div>
                <div className="flex-grow mx-4 h-0.5 bg-gray-200"></div>
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 bg-gray-200 text-gray-600 flex items-center justify-center rounded-full">2</div>
                  <span className="text-xs mt-1 text-gray-600">Email Preview</span>
                </div>
                <div className="flex-grow mx-4 h-0.5 bg-gray-200"></div>
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 bg-gray-200 text-gray-600 flex items-center justify-center rounded-full">3</div>
                  <span className="text-xs mt-1 text-gray-600">Submit</span>
                </div>
              </div>
            </div>

            {/* Issue title */}
            <div>
              <Label htmlFor="title">Issue Title</Label>
              <Select
                onValueChange={(value) => handleSelectChange("title", value)}
                value={formData.title}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select a title for your issue" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="infrastructure_repair">Infrastructure Repair Needed</SelectItem>
                  <SelectItem value="safety_concern">Safety Concern</SelectItem>
                  <SelectItem value="street_improvement">Street Improvement Request</SelectItem>
                  <SelectItem value="damaged_infrastructure">Damaged Infrastructure</SelectItem>
                  <SelectItem value="maintenance_request">Maintenance Request</SelectItem>
                  <SelectItem value="accessibility_issue">Accessibility Issue</SelectItem>
                  <SelectItem value="pedestrian_safety">Pedestrian Safety Concern</SelectItem>
                  <SelectItem value="traffic_hazard">Traffic Hazard</SelectItem>
                  <SelectItem value="community_improvement">Community Improvement</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Issue type */}
            <div>
              <Label htmlFor="issueType">Issue Type</Label>
              <Select
                onValueChange={(value) => handleSelectChange("issueType", value)}
                value={formData.issueType}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select an issue type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select an issue type</SelectItem>
                  <SelectItem value="crosswalk">Crosswalk Needed</SelectItem>
                  <SelectItem value="pothole">Pothole</SelectItem>
                  <SelectItem value="sidewalk">Sidewalk Damage</SelectItem>
                  <SelectItem value="streetlight">Street Light Needed</SelectItem>
                  <SelectItem value="flooding">Flooding</SelectItem>
                  <SelectItem value="traffic_sign">Traffic Sign Issue</SelectItem>
                  <SelectItem value="road_damage">Road Damage</SelectItem>
                  <SelectItem value="utility_failure">Utility Failure</SelectItem>
                  <SelectItem value="graffiti">Graffiti</SelectItem>
                  <SelectItem value="tree_hazard">Tree Hazard</SelectItem>
                  <SelectItem value="accessibility">Accessibility Issue</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Location */}
            <div>
              <Label htmlFor="location">Location</Label>
              <div className="mt-1 flex rounded-md shadow-sm">
                <Select
                  onValueChange={(value) => handleSelectChange("location", value)}
                  value={formData.location}
                >
                  <SelectTrigger className="w-full rounded-l-md rounded-r-none">
                    <SelectValue placeholder="Select a location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="imperial_ave">Imperial Avenue</SelectItem>
                    <SelectItem value="4th_street">4th Street</SelectItem>
                    <SelectItem value="8th_street">8th Street</SelectItem>
                    <SelectItem value="main_street">Main Street</SelectItem>
                    <SelectItem value="dogwood_road">Dogwood Road</SelectItem>
                    <SelectItem value="ross_avenue">Ross Avenue</SelectItem>
                    <SelectItem value="plaza_drive">Plaza Drive</SelectItem>
                    <SelectItem value="danenberg_drive">Danenberg Drive</SelectItem>
                    <SelectItem value="worthington_road">Worthington Road</SelectItem>
                    <SelectItem value="cole_road">Cole Road</SelectItem>
                    <SelectItem value="aten_road">Aten Road</SelectItem>
                    <SelectItem value="la_brucherie_road">La Brucherie Road</SelectItem>
                    <SelectItem value="imperial_valley_college">Imperial Valley College</SelectItem>
                    <SelectItem value="imperial_valley_mall">Imperial Valley Mall</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-l-none"
                  onClick={() => document.getElementById('location-map-section')?.scrollIntoView({ behavior: 'smooth' })}
                >
                  <i className="fas fa-map-marker-alt mr-2"></i>
                  Map
                </Button>
              </div>
              
              {/* Map */}
              <div id="location-map-section" className="mt-3 h-48 bg-gray-100 rounded-md relative">
                <MapComponent
                  onLocationSelect={handleLocationSelect}
                  initialLocation={{
                    lat: formData.latitude,
                    lng: formData.longitude,
                  }}
                  height="12rem"
                />
              </div>
            </div>
            
            {/* Description */}
            <div>
              <Label htmlFor="description">Description</Label>
              <Select
                onValueChange={(value) => handleSelectChange("description", value)}
                value={formData.description}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select a description" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="needs_repair">Needs repair</SelectItem>
                  <SelectItem value="safety_hazard">Safety hazard</SelectItem>
                  <SelectItem value="not_functioning">Not functioning</SelectItem>
                  <SelectItem value="damaged">Damaged and needs attention</SelectItem>
                  <SelectItem value="poor_condition">In poor condition</SelectItem>
                  <SelectItem value="missing">Missing and needs installation</SelectItem>
                  <SelectItem value="outdated">Outdated and needs replacement</SelectItem>
                  <SelectItem value="accessibility_barrier">Creates accessibility barrier</SelectItem>
                  <SelectItem value="ongoing_issue">Ongoing issue for months</SelectItem>
                </SelectContent>
              </Select>
              <p className="mt-2 text-sm text-gray-500">Brief description of the issue and its impact on the community.</p>
            </div>
            
            {/* Urgency level */}
            <div>
              <Label>Urgency Level</Label>
              <RadioGroup
                className="mt-2 flex items-center space-x-4"
                value={formData.urgencyLevel}
                onValueChange={(value) => handleSelectChange("urgencyLevel", value)}
              >
                <div className="flex items-center">
                  <RadioGroupItem id="urgency-low" value="low" />
                  <Label htmlFor="urgency-low" className="ml-2">Low</Label>
                </div>
                <div className="flex items-center">
                  <RadioGroupItem id="urgency-medium" value="medium" />
                  <Label htmlFor="urgency-medium" className="ml-2">Medium</Label>
                </div>
                <div className="flex items-center">
                  <RadioGroupItem id="urgency-high" value="high" />
                  <Label htmlFor="urgency-high" className="ml-2">High</Label>
                </div>
              </RadioGroup>
            </div>
            
            {/* Additional customization fields - collapsible section */}
            <div className="border border-gray-200 rounded-md p-4">
              <div className="flex items-center justify-between cursor-pointer mb-2">
                <h3 className="text-sm font-medium text-gray-700">Optional Details for Better Email Generation</h3>
                <i className="fas fa-chevron-down text-gray-500"></i>
              </div>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="affectedGroups">Who is affected by this issue?</Label>
                  <Select
                    onValueChange={(value) => handleSelectChange("affectedGroups", value)}
                    value={formData.affectedGroups}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select affected groups" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select affected groups</SelectItem>
                      <SelectItem value="local_residents">Local Residents</SelectItem>
                      <SelectItem value="pedestrians">Pedestrians</SelectItem>
                      <SelectItem value="cyclists">Cyclists</SelectItem>
                      <SelectItem value="drivers">Drivers/Motorists</SelectItem>
                      <SelectItem value="children">Children/Students</SelectItem>
                      <SelectItem value="elderly">Elderly People</SelectItem>
                      <SelectItem value="disabled">People with Disabilities</SelectItem>
                      <SelectItem value="businesses">Local Businesses</SelectItem>
                      <SelectItem value="all">Everyone in the Community</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="impactLevel">What is the impact level?</Label>
                  <Select
                    onValueChange={(value) => handleSelectChange("impactLevel", value)}
                    value={formData.impactLevel}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select impact level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select impact level</SelectItem>
                      <SelectItem value="minimal">Minimal - Minor inconvenience</SelectItem>
                      <SelectItem value="moderate">Moderate - Daily disruption</SelectItem>
                      <SelectItem value="significant">Significant - Safety risk</SelectItem>
                      <SelectItem value="severe">Severe - Immediate danger</SelectItem>
                      <SelectItem value="critical">Critical - Emergency situation</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="desiredOutcome">What outcome are you seeking?</Label>
                  <Select
                    onValueChange={(value) => handleSelectChange("desiredOutcome", value)}
                    value={formData.desiredOutcome}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select desired outcome" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select desired outcome</SelectItem>
                      <SelectItem value="repair">Repair existing infrastructure</SelectItem>
                      <SelectItem value="replace">Replace damaged infrastructure</SelectItem>
                      <SelectItem value="install">Install new infrastructure</SelectItem>
                      <SelectItem value="maintain">Regular maintenance</SelectItem>
                      <SelectItem value="inspect">Professional inspection</SelectItem>
                      <SelectItem value="plan">Create action plan</SelectItem>
                      <SelectItem value="other">Other (describe in description)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            
            {/* Contact info */}
            <div>
              <Label htmlFor="contactEmail">Your Contact Info (optional)</Label>
              <Input
                type="email"
                id="contactEmail"
                name="contactEmail"
                value={formData.contactEmail}
                onChange={handleInputChange}
                placeholder="email@example.com"
                className="mt-1"
              />
              <p className="mt-2 text-sm text-gray-500">We'll use this to send you updates about this issue.</p>
            </div>
            
            {/* Photo upload */}
            <div>
              <Label htmlFor="photoUpload">Upload or Capture a Photo (optional)</Label>
              <div className="mt-2">
                <input
                  type="file"
                  id="photoUpload"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <input
                  type="file"
                  id="cameraInput"
                  ref={cameraInputRef}
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileChange}
                  className="hidden"
                />
                
                {formData.photoData ? (
                  <div className="relative mt-2">
                    <div className="relative rounded-md overflow-hidden border border-gray-200">
                      <img 
                        src={formData.photoData} 
                        alt="Issue photo" 
                        className="w-full h-40 object-cover"
                      />
                      {isAnalyzingPhoto && (
                        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white">
                          <Loader2 className="h-8 w-8 animate-spin mb-2" />
                          <p>Analyzing photo...</p>
                        </div>
                      )}
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute top-2 right-2 opacity-80"
                        onClick={() => setFormData(prev => ({ ...prev, photoData: null }))}
                      >
                        <i className="fas fa-times"></i>
                      </Button>
                    </div>
                    <p className="mt-2 text-sm text-gray-600">Photo added successfully. You can remove it using the X button.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div 
                      className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-md p-4 cursor-pointer"
                      onClick={handlePhotoUploadClick}
                    >
                      <Upload className="h-8 w-8 text-gray-400 mb-2" />
                      <div className="text-sm text-gray-600">
                        <span className="font-medium text-primary hover:underline">Upload a photo</span>
                      </div>
                      <p className="text-xs text-gray-500 text-center mt-1">
                        From your device
                      </p>
                    </div>
                    
                    <div 
                      className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-md p-4 cursor-pointer"
                      onClick={() => cameraInputRef.current?.click()}
                    >
                      <Camera className="h-8 w-8 text-gray-400 mb-2" />
                      <div className="text-sm text-gray-600">
                        <span className="font-medium text-primary hover:underline">Take a photo</span>
                      </div>
                      <p className="text-xs text-gray-500 text-center mt-1">
                        Using your camera
                      </p>
                    </div>
                  </div>
                )}
              </div>
              <p className="mt-2 text-sm text-gray-500">
                Adding a photo helps provide visual context to your issue report. 
                Our AI will analyze the photo to help categorize the issue.
              </p>
            </div>
            
            {/* Submit button */}
            <div className="mt-6 flex justify-end">
              <Button
                type="submit"
                className="bg-primary hover:bg-primary/90 text-white"
                disabled={generateEmailMutation.isPending}
              >
                {generateEmailMutation.isPending ? "Generating..." : "Generate Email Draft"}
              </Button>
            </div>
          </form>
        );
      
      case "email":
        return (
          <div className="space-y-6">
            {/* Step indicator */}
            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 bg-gray-200 text-gray-600 flex items-center justify-center rounded-full">
                    <i className="fas fa-check text-primary"></i>
                  </div>
                  <span className="text-xs mt-1 text-gray-600">Issue Details</span>
                </div>
                <div className="flex-grow mx-4 h-0.5 bg-primary"></div>
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 bg-primary text-white flex items-center justify-center rounded-full">2</div>
                  <span className="text-xs mt-1 text-gray-600">Email Preview</span>
                </div>
                <div className="flex-grow mx-4 h-0.5 bg-gray-200"></div>
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 bg-gray-200 text-gray-600 flex items-center justify-center rounded-full">3</div>
                  <span className="text-xs mt-1 text-gray-600">Submit</span>
                </div>
              </div>
            </div>

            {/* AI-generated email preview */}
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-500 mb-2">This AI-generated email is based on the information you provided:</p>
              
              <div className="space-y-4">
                <div>
                  <Label className="block text-sm font-medium text-gray-700">To:</Label>
                  <Input
                    type="text"
                    value={emailTemplate.emailTo}
                    className="mt-1 bg-white"
                    readOnly
                  />
                </div>
                
                <div>
                  <Label className="block text-sm font-medium text-gray-700">Subject:</Label>
                  <Input
                    type="text"
                    value={emailTemplate.emailSubject}
                    className="mt-1 bg-white"
                    readOnly
                  />
                </div>
                
                <div>
                  <Label className="block text-sm font-medium text-gray-700">Email Body:</Label>
                  <Textarea
                    rows={10}
                    value={emailTemplate.emailBody}
                    className="mt-1 bg-white"
                    readOnly
                  />
                </div>
                
                <div>
                  <Label className="block text-sm font-medium text-gray-700">Email Tone Adjustment:</Label>
                  <p className="text-xs text-gray-500 mb-2">
                    Select a tone to change the style and language of your email
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 relative">
                    {isChangingTone && (
                      <div className="absolute inset-0 bg-gray-100/50 flex items-center justify-center rounded-md z-10">
                        <div className="flex flex-col items-center">
                          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                          <p className="mt-2 text-sm text-gray-600">Updating tone...</p>
                        </div>
                      </div>
                    )}
                    <Button
                      size="sm"
                      variant={null}
                      className={`px-3 py-1 text-xs rounded-full transition-all ${getToneButtonStyle("professional")}`}
                      onClick={() => handleToneChange("professional")}
                      disabled={isChangingTone || currentTone === "professional"}
                    >
                      <i className="fas fa-briefcase mr-1"></i> Professional
                    </Button>
                    <Button
                      size="sm"
                      variant={null}
                      className={`px-3 py-1 text-xs rounded-full transition-all ${getToneButtonStyle("formal")}`}
                      onClick={() => handleToneChange("formal")}
                      disabled={isChangingTone || currentTone === "formal"}
                    >
                      <i className="fas fa-user-tie mr-1"></i> Formal
                    </Button>
                    <Button
                      size="sm"
                      variant={null}
                      className={`px-3 py-1 text-xs rounded-full transition-all ${getToneButtonStyle("assertive")}`}
                      onClick={() => handleToneChange("assertive")}
                      disabled={isChangingTone || currentTone === "assertive"}
                    >
                      <i className="fas fa-exclamation-circle mr-1"></i> Assertive
                    </Button>
                    <Button
                      size="sm"
                      variant={null}
                      className={`px-3 py-1 text-xs rounded-full transition-all ${getToneButtonStyle("concerned")}`}
                      onClick={() => handleToneChange("concerned")}
                      disabled={isChangingTone || currentTone === "concerned"}
                    >
                      <i className="fas fa-heart mr-1"></i> Concerned
                    </Button>
                    <Button
                      size="sm"
                      variant={null}
                      className={`px-3 py-1 text-xs rounded-full transition-all ${getToneButtonStyle("personal")}`}
                      onClick={() => handleToneChange("personal")}
                      disabled={isChangingTone || currentTone === "personal"}
                    >
                      <i className="fas fa-user mr-1"></i> Personal
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-6 flex justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={handleBackToDetails}
                disabled={createProjectMutation.isPending}
              >
                Back to Details
              </Button>
              <div>
                <Button
                  type="button"
                  variant="outline"
                  className="mr-2"
                  onClick={() => generateEmailMutation.mutate()}
                  disabled={generateEmailMutation.isPending || createProjectMutation.isPending}
                >
                  <i className="fas fa-sync-alt mr-2"></i>
                  Regenerate
                </Button>
                <Button
                  type="button"
                  className="bg-primary hover:bg-primary/90 text-white"
                  onClick={handleSendEmail}
                  disabled={createProjectMutation.isPending}
                >
                  <i className="fas fa-paper-plane mr-2"></i>
                  {createProjectMutation.isPending ? "Sending..." : "Send Email"}
                </Button>
              </div>
            </div>
          </div>
        );
      
      case "success":
        return (
          <SubmissionSuccessModal 
            project={submittedProject}
            onClose={handleCloseAll}
          />
        );
      
      default:
        return null;
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={handleCloseAll}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogTitle className="text-xl font-semibold text-gray-900 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <span>
            {currentStep === "details" ? "Submit a New Issue" : 
             currentStep === "email" ? "Review & Customize Email" : 
             "Success!"}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCloseAll}
            className="text-gray-400 hover:text-gray-500"
          >
            <i className="fas fa-times text-xl"></i>
          </Button>
        </DialogTitle>
        
        <div className="px-6 py-4">
          {renderStepContent()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
