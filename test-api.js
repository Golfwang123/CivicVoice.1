// Test API script

import fetch from 'node-fetch';

// Base URL for API
const API_BASE_URL = 'http://localhost:5000/api';

// Small test image (1x1 pixel) as base64
const TINY_IMAGE = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

// Test functions
async function testOpenAI() {
  console.log('\n--- Testing OpenAI API ---');
  const response = await fetch(`${API_BASE_URL}/test-openai`);
  const data = await response.json();
  console.log('Response:', data);
  return data;
}

async function testPhotoAnalysis() {
  console.log('\n--- Testing Photo Analysis ---');
  const response = await fetch(`${API_BASE_URL}/analyze-photo`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      photoData: TINY_IMAGE
    }),
  });
  const data = await response.json();
  console.log('Response:', data);
  return data;
}

async function testEmailGeneration() {
  console.log('\n--- Testing Email Generation ---');
  const response = await fetch(`${API_BASE_URL}/generate-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      issueType: 'sidewalk',
      location: '456 Elm Street',
      description: 'Cracked sidewalk causing pedestrian hazard',
      urgencyLevel: 'medium'
    }),
  });
  const data = await response.json();
  console.log('Response:', data);
  return data;
}

async function testEmailToneChange(emailData) {
  console.log('\n--- Testing Email Tone Change ---');
  const response = await fetch(`${API_BASE_URL}/regenerate-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      emailSubject: emailData.emailSubject,
      emailBody: emailData.emailBody,
      tone: 'assertive'
    }),
  });
  const data = await response.json();
  console.log('Response:', data);
  return data;
}

// Main test function
async function runTests() {
  try {
    console.log('Starting API tests...');
    
    // Test OpenAI connection
    await testOpenAI();
    
    // Test photo analysis
    await testPhotoAnalysis();
    
    // Test email generation
    const emailData = await testEmailGeneration();
    
    // Test email tone change
    if (emailData && emailData.emailBody) {
      await testEmailToneChange(emailData);
    }
    
    console.log('\n✅ All tests completed');
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the tests
runTests();