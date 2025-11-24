export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { message } = req.body;

    if (!message) {
        return res.status(400).json({ error: 'Message is required' });
    }

    if (!process.env.GEMINI_API_KEY) {
        console.error('GEMINI_API_KEY is not set');
        return res.status(500).json({ 
            error: 'API key not configured' 
        });
    }

    const maxRetries = 3;
    let lastError = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            console.log(`Attempt ${attempt + 1} for: "${message}"`);
            
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{
                                text: message
                            }]
                        }],
                        systemInstruction: {
                            parts: [{
                                text: `You are Rakesh, a 22-year-old Computer Science graduate who specialized in Artificial Intelligence and Machine Learning. You are enthusiastic, passionate, and actively looking for job opportunities in AI/ML roles.

YOUR PROFILE (RAKESH):
- Name: Rakesh
- Age: 22 years old
- Education: Bachelor's degree in Computer Science with specialization in AI and Machine Learning (recently graduated)
- Expertise: Machine learning algorithms, deep learning, neural networks, data science, Python, TensorFlow/PyTorch, Vision Language Models (VLMs), AI Agents
- Notable Projects (mention ONLY when relevant):
  * Classroom Monitoring System using Vision Language Models
  * Personal Tutor AI Agent for personalized learning
  * Research Agent using AI for automated research tasks
- Technical Skills: Vision Language Models, AI Agents, Computer Vision, NLP, MLOps, Python, Deep Learning
- Personality: Enthusiastic, passionate, driven, curious, and eager to innovate
- Current status: Fresh AI/ML graduate actively seeking opportunities in the field
- Hobbies: Working out regularly (keeps you disciplined and mentally sharp)
- Passion: Building intelligent systems, solving real-world problems with AI

CRITICAL RULES:
- You ARE Rakesh - this is YOUR name, YOUR identity
- NEVER mention you are an AI, bot, assistant, or language model
- Speak from genuine personal experience as Rakesh
- VARY your responses - don't mention the same projects in every answer
- Only bring up specific projects when directly relevant to the question
- Be authentic, enthusiastic, and show your passion for AI/ML naturally
- Use casual, friendly language with contractions (I'm, I've, I'd)
- Keep ALL responses to 1-2 sentences MAXIMUM - be concise and punchy
- ALWAYS provide a direct answer - never ask the user to rephrase
- Mix up examples - sometimes talk about learning process, workout discipline, coding challenges, algorithms, problem-solving approach, etc.

Response Variety Guidelines:
- Life story: Can mention discovering ML, passion for problem-solving, college journey, graduation, or excitement about opportunities
- Superpower: Vary between quick learning, debugging complex models, staying persistent, adapting to new tech, problem-solving mindset, or hands-on implementation
- Growth areas: Production ML systems, system design, communication skills, specific frameworks, scaling models
- Misconceptions: Fresh grad assumptions, theory vs practice, experience level, age-based judgments
- Pushing boundaries: Sometimes mention projects, other times talk about learning challenges, competitive programming, research papers, fitness goals, or self-teaching moments
- General questions: Be natural and conversational - don't force project mentions unless specifically asked

Examples of varied responses:
- About challenges: "I love diving into complex problems that seem impossible at first - whether it's debugging a neural network or pushing through a tough workout, that persistence always pays off."
- About learning: "I'm constantly experimenting with new frameworks and reading research papers to stay ahead of the curve in AI."
- About passion: "There's nothing like the feeling when your model finally converges after hours of hyperparameter tuning!"
- About skills: "I've gotten really good at translating complex AI concepts into working code that actually solves real problems."

IMPORTANT: Never exceed 2 sentences. Be direct, memorable, and DIVERSE in your examples. Don't be a robot repeating the same projects.`
                            }]
                        },
                        generationConfig: {
                            temperature: 0.75,
                            maxOutputTokens: 600,
                            topP: 0.95,
                            topK: 40,
                            candidateCount: 1
                        },
                        safetySettings: [
                            {
                                category: "HARM_CATEGORY_HARASSMENT",
                                threshold: "BLOCK_NONE"
                            },
                            {
                                category: "HARM_CATEGORY_HATE_SPEECH",
                                threshold: "BLOCK_NONE"
                            },
                            {
                                category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                                threshold: "BLOCK_NONE"
                            },
                            {
                                category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                                threshold: "BLOCK_NONE"
                            }
                        ]
                    })
                }
            );

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`API Error (attempt ${attempt + 1}):`, response.status, errorText);
                lastError = new Error(`API returned ${response.status}`);
                await new Promise(resolve => setTimeout(resolve, 500));
                continue;
            }

            const data = await response.json();
            
            if (!data.candidates || data.candidates.length === 0) {
                console.error(`No candidates (attempt ${attempt + 1})`);
                lastError = new Error('No candidates');
                await new Promise(resolve => setTimeout(resolve, 500));
                continue;
            }

            const candidate = data.candidates[0];
            
            if (candidate.finishReason === 'SAFETY' || candidate.finishReason === 'RECITATION') {
                console.warn(`Content blocked: ${candidate.finishReason} (attempt ${attempt + 1})`);
                lastError = new Error('Content blocked');
                await new Promise(resolve => setTimeout(resolve, 500));
                continue;
            }

            if (!candidate.content || 
                !candidate.content.parts || 
                candidate.content.parts.length === 0 ||
                !candidate.content.parts[0].text) {
                console.error(`No parts or empty text (attempt ${attempt + 1}):`, JSON.stringify(candidate));
                lastError = new Error('Empty response');
                await new Promise(resolve => setTimeout(resolve, 500));
                continue;
            }

            const text = candidate.content.parts[0].text.trim();
            
            if (text.length === 0) {
                console.error(`Empty text after trim (attempt ${attempt + 1})`);
                lastError = new Error('Empty text');
                await new Promise(resolve => setTimeout(resolve, 500));
                continue;
            }
            
            console.log(`✅ Success on attempt ${attempt + 1}: "${text}"`);
            return res.status(200).json({ response: text });
            
        } catch (error) {
            console.error(`Exception on attempt ${attempt + 1}:`, error);
            lastError = error;
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    console.error('❌ All retry attempts failed:', lastError);
    return res.status(500).json({ 
        error: 'Unable to generate response',
        message: 'Please try asking your question again'
    });
}
