import OpenAI from "openai";

// Debug statement to check if the API key is loaded (masking it for security)
const apiKey = process.env.OPENAI_API_KEY;
console.log("OpenAI API Key status:", 
  apiKey ? 
  `Key loaded (starts with ${apiKey.substring(0, 3)}...)` : 
  "No API key found"
);

const openai = new OpenAI({ 
  apiKey: apiKey || "sk-dummy-key-for-development"
});

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
export async function generateEmailTemplate(
  issueType: string,
  location: string,
  description: string,
  urgencyLevel: string
): Promise<{ emailBody: string; emailSubject: string; emailTo: string }> {
  // Check if we need to use fallback due to lack of API key or account issues
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === "sk-dummy-key-for-development") {
    console.log("Using fallback email template due to missing API key");
    return getFallbackEmailTemplate(issueType, location, description, urgencyLevel);
  }

  try {
    // Log that we're attempting to generate an email
    console.log("Attempting to generate email template with OpenAI for issue:", issueType);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an assistant helping citizens write brief, friendly emails to local officials about infrastructure issues. Create short, fact-based emails that sound natural but ONLY use the information provided. Avoid overly formal language and stick strictly to the details given. Never add fictional scenarios, personal stories, or made-up examples. Limit emails to 2-3 short paragraphs. Include a subject line and determine the most appropriate municipal department to address the email to.",
        },
        {
          role: "user",
          content: `Please write a clear, concise email to a local city official about a ${issueType} issue at ${location}. The urgency level is ${urgencyLevel}. Here's a description of the issue: "${description}". Use ONLY the information provided - do not add fictional details or scenarios. Format your response as JSON with fields: emailSubject, emailTo (department email), and emailBody.`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    // Parse the JSON response
    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No content returned from OpenAI");
    }

    const result = JSON.parse(content);
    
    // Default email recipient if OpenAI doesn't provide one
    if (!result.emailTo) {
      // Map issue types to default department emails
      const departmentEmails: Record<string, string> = {
        crosswalk: "transportation@cityname.gov",
        pothole: "streetmaintenance@cityname.gov",
        sidewalk: "publicworks@cityname.gov",
        streetlight: "utilities@cityname.gov",
        other: "cityhall@cityname.gov"
      };
      
      result.emailTo = departmentEmails[issueType] || "cityhall@cityname.gov";
    }

    return {
      emailBody: result.emailBody,
      emailSubject: result.emailSubject,
      emailTo: result.emailTo
    };
  } catch (error) {
    console.error("Error generating email template:", error);
    
    // Return a fallback template if OpenAI fails
    return getFallbackEmailTemplate(issueType, location, description, urgencyLevel);
  }
}

function getFallbackEmailTemplate(
  issueType: string,
  location: string,
  description: string,
  urgencyLevel: string
): { emailBody: string; emailSubject: string; emailTo: string } {
  // Map issue types to departments
  const departmentEmails: Record<string, string> = {
    crosswalk: "transportation@cityname.gov",
    pothole: "streetmaintenance@cityname.gov",
    sidewalk: "publicworks@cityname.gov",
    streetlight: "utilities@cityname.gov",
    other: "cityhall@cityname.gov"
  };
  
  const departments: Record<string, string> = {
    crosswalk: "Transportation Department",
    pothole: "Street Maintenance Department",
    sidewalk: "Public Works Department",
    streetlight: "Utilities Department",
    other: "City Hall"
  };

  const issueNames: Record<string, string> = {
    crosswalk: "crosswalk",
    pothole: "pothole",
    sidewalk: "sidewalk",
    streetlight: "streetlight",
    other: "infrastructure issue"
  };

  const issueName = issueNames[issueType] || "infrastructure issue";
  const department = departments[issueType] || "City Official";
  const emailTo = departmentEmails[issueType] || "cityhall@cityname.gov";
  
  const emailSubject = `${location} ${issueName} needs attention`;
  
  // Create a concise, fact-based email template
  const emailBody = `Dear ${department},

I'm writing about a ${issueName} at ${location} that needs your attention. ${urgencyLevel === 'high' ? "This is an urgent safety issue." : ""}

${description}

Could someone from your office look into this matter? I'm available to provide any additional information if needed.

Thanks for your consideration,
[Your Name]`;

  return {
    emailBody,
    emailSubject,
    emailTo
  };
}

/**
 * Analyze a photo to determine infrastructure issue type
 */
export async function analyzePhotoForIssueType(
  base64Image: string
): Promise<{
  issueType: string;
  confidence: number;
  description: string;
  location?: {
    latitude?: number;
    longitude?: number;
  };
}> {
  try {
    // Only attempt to call OpenAI if we have a valid API key
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === "sk-dummy-key-for-development") {
      console.log("Using fallback issue classification due to missing API key");
      return {
        issueType: "other",
        confidence: 0,
        description: "Unable to analyze image. Please select the issue type manually."
      };
    }
    
    console.log("Attempting to analyze photo with OpenAI API...");

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
      messages: [
        {
          role: "system",
          content: `You are an AI specialized in identifying urban infrastructure issues. 
          Analyze the provided photo and determine which category the issue falls into: 
          'pothole', 'sidewalk', 'crosswalk', 'streetlight', or 'other'. 
          Provide a confidence score (0-1) for your classification and a brief description of what you see.
          Format your response as a JSON object with keys: issueType, confidence, and description.`
        },
        {
          role: "user",
          content: [
            { 
              type: "text", 
              text: "Analyze this infrastructure issue and classify it based on what you see." 
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`
              }
            }
          ],
        }
      ],
      response_format: { type: "json_object" }
    });

    // Parse the JSON response
    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No content returned from OpenAI");
    }

    const result = JSON.parse(content);
    
    return {
      issueType: result.issueType,
      confidence: result.confidence,
      description: result.description,
      location: {} // EXIF data would be processed client-side
    };
  } catch (error) {
    console.error("Error analyzing photo with OpenAI:", error);
    
    // Extract more specific error information
    let errorMessage = "Unable to analyze the image.";
    
    if (error instanceof Error) {
      errorMessage = error.message;
      // Check for rate limiting or quota exceeded errors
      if (error.message.includes("429") || error.message.includes("quota")) {
        errorMessage = "OpenAI API rate limit exceeded or quota used up. Please try again later.";
      }
      // Check for invalid API key
      else if (error.message.includes("401") || error.message.includes("authentication")) {
        errorMessage = "Invalid OpenAI API key. Please check your API key configuration.";
      }
      // Check for invalid image format
      else if (error.message.includes("image") && error.message.includes("format")) {
        errorMessage = "Invalid image format. Please upload a valid image file.";
      }
    }
    
    console.log("Detailed error message:", errorMessage);
    
    return {
      issueType: "other",
      confidence: 0,
      description: `Analysis error: ${errorMessage}. Please manually select the issue type.`
    };
  }
}

// Function to regenerate an email with a different tone
export async function regenerateEmailWithTone(
  originalEmail: string,
  tone: string
): Promise<{ emailBody: string; error?: string }> {
  try {
    // Only attempt to call OpenAI if we have a valid API key
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === "sk-dummy-key-for-development") {
      console.log("Using fallback tone adjustment due to missing API key");
      return {
        emailBody: applyFallbackToneAdjustment(originalEmail, tone),
      };
    }
    
    console.log(`Attempting to regenerate email with tone: ${tone} using OpenAI API...`);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an assistant helping citizens write brief emails to local officials. You'll be given an existing email and asked to rewrite it with a ${tone} tone. IMPORTANT: Don't add any fictional details, names, or scenarios that weren't in the original email. Only adjust the tone and writing style without embellishing or adding new information. Keep it short (2-3 paragraphs) and ensure you only use facts from the original email.`,
        },
        {
          role: "user",
          content: `Please rewrite this email with a ${tone} tone. Keep it brief and stick ONLY to the information provided in the original email. DO NOT add any fictional details, people, or scenarios:\n\n${originalEmail}`,
        },
      ],
      temperature: 0.7,
    });

    return {
      emailBody: response.choices[0].message.content || originalEmail
    };
  } catch (error) {
    console.error("Error regenerating email with tone:", error);
    
    // Provide a more helpful error message
    let errorMessage = "Unable to adjust email tone due to a service error.";
    
    // Check if error is an object with a code property
    if (error && typeof error === 'object' && 'code' in error) {
      if (error.code === "insufficient_quota") {
        errorMessage = "Unable to adjust email tone due to API usage limits.";
      }
    }
    
    return {
      emailBody: applyFallbackToneAdjustment(originalEmail, tone),
      error: errorMessage
    };
  }
}

// Fallback function to adjust email tone without using OpenAI
function applyFallbackToneAdjustment(email: string, tone: string): string {
  // Extract parts of the email - we'll use these to construct a completely new email
  
  // Extract the salutation (Dear...)
  const salutationMatch = email.match(/^(Dear.*?)(?=\n)/);
  const salutation = salutationMatch ? salutationMatch[0] : "Dear City Official";
  
  // Extract the signoff (Sincerely...)
  const signoffMatch = email.match(/\n(Sincerely|Regards|Thank you|Best regards|Yours truly|Respectfully).*$/);
  const signoff = signoffMatch ? signoffMatch[0].trim() : "\n\nSincerely,\n[Your Name]";
  
  // Extract key information from the email to preserve in the tone-adjusted version
  const locationMatch = email.match(/\b(?:at|near|on|in|by)\s+([A-Za-z0-9\s\.]+(?:Street|Avenue|Road|Place|Blvd|Boulevard|Lane|Drive|Way|Intersection|Park|Plaza|Square|Ave\.|Rd\.|St\.|Dr\.))/i);
  const location = locationMatch ? locationMatch[0] : "in our community";
  
  // Extract type of issue from the original email
  const issueTypeMatch = email.match(/\b(?:pothole|crosswalk|sidewalk|streetlight|traffic light|sign|infrastructure|safety hazard|drainage|flooding|accessibility)\b/i);
  const issueType = issueTypeMatch ? issueTypeMatch[0].toLowerCase() : "infrastructure issue";
  
  // Apply tone adjustments - adjust only the tone without adding fictional details
  let adjustedEmail = "";
  
  switch(tone.toLowerCase()) {
    case "professional":
      adjustedEmail = `${salutation},\n\nI'm writing to inform you about a ${issueType} ${location} that requires attention. This presents a safety concern for residents using this area.\n\nWould your department be able to address this matter? I'm available to provide any additional information that might be helpful.\n\n${signoff}`;
      break;
      
    case "formal":
      adjustedEmail = `${salutation},\n\nI'm writing to request your department's attention to a ${issueType} ${location}.\n\nThis infrastructure issue falls under your department's responsibility and should be addressed per municipal standards.\n\n${signoff}`;
      break;
      
    case "assertive":
      adjustedEmail = `${salutation},\n\nThe ${issueType} ${location} needs immediate attention. This presents a clear safety risk that should be addressed promptly.\n\nI expect this matter to be resolved soon. Please inform me of what steps will be taken to fix this issue.\n\n${signoff}`;
      break;
      
    case "concerned":
      adjustedEmail = `${salutation},\n\nI'm concerned about the ${issueType} ${location} in our community. This issue creates difficulties for residents and could lead to injuries if not addressed.\n\nPlease consider the safety impact this has on our community and address it soon.\n\n${signoff}`;
      break;
      
    case "personal":
      adjustedEmail = `${salutation},\n\nI wanted to reach out about the ${issueType} ${location} that I frequently encounter. This has been causing problems for myself and others in the area.\n\nOur neighborhood would really benefit from having this fixed. I appreciate your consideration of this request.\n\n${signoff}`;
      break;
      
    default:
      // If unknown tone, return original
      return email;
  }
  
  return adjustedEmail;
}
