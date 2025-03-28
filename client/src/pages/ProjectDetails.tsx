import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Project, Comment } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import EmailPreviewModal from "@/components/EmailPreviewModal";
import MapComponent from "@/components/MapComponent";

// Map progress status to display text and percentage
const progressMap: Record<string, { text: string; percentage: number }> = {
  idea_submitted: { text: "Idea Submitted", percentage: 15 },
  community_support: { text: "Community Support", percentage: 35 },
  email_campaign_active: { text: "Email Campaign Active", percentage: 50 },
  official_acknowledgment: { text: "Official Acknowledgment", percentage: 65 },
  planning_stage: { text: "Planning Stage", percentage: 80 },
  implementation: { text: "Implementation", percentage: 90 },
  completed: { text: "Completed", percentage: 100 },
};

// Map issue types to colors
const typeColorMap: Record<string, string> = {
  crosswalk: "bg-blue-100 text-blue-800",
  pothole: "bg-red-100 text-red-800",
  sidewalk: "bg-green-100 text-green-800",
  streetlight: "bg-yellow-100 text-yellow-800",
  other: "bg-purple-100 text-purple-800",
};

export default function ProjectDetails() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commenterName, setCommenterName] = useState("");
  
  // Format issue type for display
  const formatIssueType = (type: string) => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };
  
  // Fetch the project details
  const { data: project, isLoading, error } = useQuery<Project>({
    queryKey: ['/api/projects', id],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${id}`);
      if (!response.ok) {
        if (response.status === 404) {
          navigate("/not-found");
          throw new Error("Project not found");
        }
        throw new Error("Failed to fetch project details");
      }
      return response.json();
    },
  });
  
  // Fetch project comments
  const { data: comments = [] } = useQuery<Comment[]>({
    queryKey: ['/api/projects', id, 'comments'],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${id}/comments`);
      if (!response.ok) {
        throw new Error("Failed to fetch comments");
      }
      return response.json();
    },
    enabled: !!id,
  });
  
  // Upvote mutation
  const upvoteMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/projects/${id}/upvote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to upvote project");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', id] });
      toast({
        title: "Success!",
        description: "Your upvote has been recorded.",
      });
    },
  });
  
  // Add comment mutation
  const addCommentMutation = useMutation({
    mutationFn: async () => {
      const comment = {
        projectId: Number(id),
        text: commentText,
        commenterName: commenterName || 'Anonymous',
      };
      
      const response = await fetch(`/api/projects/${id}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(comment),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to add comment");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', id, 'comments'] });
      setCommentText("");
      toast({
        title: "Comment Added",
        description: "Your comment has been added successfully.",
      });
    },
  });
  
  const handleUpvote = () => {
    upvoteMutation.mutate();
  };
  
  const handleEmailClick = () => {
    setIsEmailModalOpen(true);
  };
  
  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (commentText.trim()) {
      addCommentMutation.mutate();
    } else {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Comment text cannot be empty.",
      });
    }
  };
  
  // Show loading state
  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-40 bg-gray-200 rounded"></div>
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-full"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }
  
  // Handle error state
  if (error || !project) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600">Error Loading Project</h2>
          <p className="mt-2 text-gray-600">
            There was an error loading the project details. Please try again later.
          </p>
          <Button 
            onClick={() => navigate("/")}
            className="mt-4 bg-primary hover:bg-primary/90 text-white"
          >
            Return to Community Board
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Button 
        onClick={() => navigate("/")} 
        variant="ghost" 
        className="mb-6 hover:bg-gray-100"
      >
        <i className="fas fa-arrow-left mr-2"></i>
        Back to Community Board
      </Button>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Project Details */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white shadow-sm rounded-lg overflow-hidden p-6">
            <div className="flex justify-between items-start">
              <div>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${typeColorMap[project.issueType] || "bg-gray-100 text-gray-800"} mb-2`}>
                  {formatIssueType(project.issueType)}
                </span>
                <h1 className="text-2xl font-bold text-gray-900">{project.title}</h1>
              </div>
              <div className="flex items-center text-gray-700">
                <button 
                  className={`flex flex-col items-center ${upvoteMutation.isPending ? 'opacity-50 cursor-not-allowed' : 'hover:text-primary transition-colors'}`}
                  onClick={handleUpvote}
                  disabled={upvoteMutation.isPending}
                >
                  <i className="fas fa-arrow-up text-xl"></i>
                  <span className="text-xs font-semibold mt-1">{project.upvotes}</span>
                </button>
              </div>
            </div>
            
            <div className="mt-4">
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium text-gray-700">Progress Status</span>
                <span className="text-sm font-medium text-gray-700">
                  {progressMap[project.progressStatus]?.text || "Unknown Status"}
                </span>
              </div>
              <Progress 
                value={progressMap[project.progressStatus]?.percentage || 0} 
                className="h-2.5 bg-gray-200"
              />
            </div>
            
            <div className="mt-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Description</h2>
              <p className="text-gray-700">{project.description}</p>
            </div>
            
            {/* Photo (if available) */}
            {(project.photoUrl || project.photoData) && (
              <div className="mt-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">Photo</h2>
                <div className="relative rounded-md overflow-hidden border border-gray-200">
                  <img 
                    src={project.photoUrl || project.photoData} 
                    alt="Issue photo" 
                    className="w-full max-h-[400px] object-contain"
                  />
                </div>
              </div>
            )}
            
            <div className="mt-6 grid grid-cols-2 gap-4">
              <div className="col-span-1">
                <h3 className="text-sm font-medium text-gray-500">Location</h3>
                <p className="mt-1 text-sm text-gray-900">{project.location}</p>
              </div>
              <div className="col-span-1">
                <h3 className="text-sm font-medium text-gray-500">Urgency Level</h3>
                <p className="mt-1 text-sm text-gray-900 capitalize">{project.urgencyLevel}</p>
              </div>
              <div className="col-span-1">
                <h3 className="text-sm font-medium text-gray-500">Emails Sent</h3>
                <p className="mt-1 text-sm text-gray-900">{project.emailsSent}</p>
              </div>
              <div className="col-span-1">
                <h3 className="text-sm font-medium text-gray-500">Date Submitted</h3>
                <p className="mt-1 text-sm text-gray-900">
                  {new Date(project.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
            
            <div className="mt-8 border-t border-gray-200 pt-6">
              <Button 
                className="bg-primary hover:bg-primary/90 text-white"
                onClick={handleEmailClick}
              >
                <i className="fas fa-envelope mr-2"></i>
                Send Email to Support This Issue
              </Button>
            </div>
          </div>
          
          {/* Comments Section */}
          <div className="bg-white shadow-sm rounded-lg overflow-hidden p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Community Discussion</h2>
            
            {/* Comment Form */}
            <form onSubmit={handleAddComment} className="mb-6 border-b border-gray-200 pb-6">
              <div className="mb-4">
                <Label htmlFor="commenterName">Your Name (Optional)</Label>
                <Input
                  id="commenterName"
                  value={commenterName}
                  onChange={(e) => setCommenterName(e.target.value)}
                  placeholder="Enter your name"
                  className="mt-1"
                />
              </div>
              <div className="mb-4">
                <Label htmlFor="commentText">Comment</Label>
                <Textarea
                  id="commentText"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Share your thoughts about this issue..."
                  rows={3}
                  className="mt-1"
                />
              </div>
              <div className="flex justify-end">
                <Button
                  type="submit"
                  className="bg-primary hover:bg-primary/90 text-white"
                  disabled={addCommentMutation.isPending}
                >
                  {addCommentMutation.isPending ? "Posting..." : "Post Comment"}
                </Button>
              </div>
            </form>
            
            {/* Comments List */}
            <div className="space-y-4">
              {comments.length === 0 ? (
                <p className="text-gray-500 text-center py-4">
                  No comments yet. Be the first to share your thoughts!
                </p>
              ) : (
                comments.map((comment) => (
                  <Card key={comment.id} className="border-gray-200">
                    <CardHeader className="p-4 pb-2">
                      <div className="flex justify-between items-center">
                        <CardTitle className="text-sm font-medium">{comment.commenterName}</CardTitle>
                        <span className="text-xs text-gray-500">
                          {new Date(comment.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-2">
                      <p className="text-gray-700">{comment.text}</p>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        </div>
        
        {/* Sidebar */}
        <div className="space-y-6">
          {/* Map */}
          <div className="bg-white shadow-sm rounded-lg overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h2 className="font-medium text-gray-800">Location</h2>
            </div>
            <div className="h-[300px]">
              <MapComponent
                initialLocation={{
                  lat: project.latitude,
                  lng: project.longitude
                }}
                height="300px"
              />
            </div>
          </div>
          
          {/* Nearby Issues */}
          <div className="bg-white shadow-sm rounded-lg overflow-hidden p-4">
            <h2 className="font-medium text-gray-800 mb-4">Similar Issues Nearby</h2>
            <div className="text-center text-gray-500 py-4">
              <p>This feature is coming soon!</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Email Modal */}
      {isEmailModalOpen && (
        <EmailPreviewModal 
          project={project}
          isOpen={isEmailModalOpen}
          onClose={() => setIsEmailModalOpen(false)}
        />
      )}
    </main>
  );
}