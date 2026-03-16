import os
from groq import Groq
from typing import List, Dict, Any
import json

class AIService:
    def __init__(self):
        self.api_key = os.getenv("GROQ_API_KEY")
        if self.api_key:
            self.client = Groq(api_key=self.api_key)
        else:
            self.client = None

    def generate_recommendations(self, risk_factors: Dict[str, float], behavior_summary: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate personalized recommendations using Groq AI."""
        if not self.client:
            return self._get_fallback_recommendations(risk_factors)

        prompt = f"""
        You are an elite AI Cybersecurity Assistant. Based on the following user risk profile, generate 3-4 highly specific, actionable security recommendations.
        Return ONLY valid JSON in this format:
        [
            {{"type": "critical|warning|info", "title": "Brief Title", "description": "Specific advice"}}
        ]

        Risk Profile:
        - Breach Risk: {risk_factors.get('breach_risk', 0)*100}%
        - URL Risk: {risk_factors.get('malicious_urls', 0)*100}%
        - Message Risk: {risk_factors.get('suspicious_messages', 0)*100}%
        - Password Risk: {risk_factors.get('password_risk', 0)*100}%

        User Behavior Summary:
        - Total Activities: {behavior_summary.get('total_activities', 0)}
        - Sensitive Domain Visits: {behavior_summary.get('sensitive_visits', 0)}
        """

        try:
            completion = self.client.chat.completions.create(
                model="llama3-8b-8192",
                messages=[
                    {"role": "system", "content": "You are a professional cybersecurity expert. Return JSON."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                response_format={"type": "json_object"}
            )
            
            response_content = completion.choices[0].message.content
            # Llama 3 JSON format might be wrapped in a root object
            data = json.loads(response_content)
            if isinstance(data, dict) and "recommendations" in data:
                return data["recommendations"]
            return data if isinstance(data, list) else []
        except Exception as e:
            print(f"Groq API Error: {e}")
            return self._get_fallback_recommendations(risk_factors)

    def generate_incident_guidance(self, scenario: str) -> List[str]:
        """Generate step-by-step incident guidance using Groq AI."""
        if not self.client:
            return ["Disconnect from internet.", "Change passwords."]

        prompt = f"""
        A user is experiencing the following cybersecurity incident: {scenario}.
        Provide exactly 3 immediate, high-priority steps they must take to secure their accounts and data.
        Keep each step concise and professional.
        Return ONLY a JSON list of strings.
        """

        try:
            completion = self.client.chat.completions.create(
                model="llama3-8b-8192",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
            )
            
            content = completion.choices[0].message.content
            # Basic parsing if LLM doesn't return pure JSON
            if "[" in content and "]" in content:
                content = content[content.find("["):content.find("]")+1]
            return json.loads(content)
        except Exception as e:
            print(f"Groq API Error: {e}")
            return ["Isolate infected devices.", "Reset credentials.", "Monitor accounts."]

    def chat(self, user_message: str, history: List[Dict[str, str]] = []) -> str:
        """Handle conversational security chat using Groq."""
        if not self.client:
            return "I'm currently in offline mode. Please check your API key."

        messages = [
            {"role": "system", "content": "You are Cypherium AI, a friendly and expert cybersecurity assistant. Provide concise, expert advice on digital safety, phishing, and privacy. Use markdown for formatting."}
        ]
        
        # Add limited history
        messages.extend(history[-4:])
        messages.append({"role": "user", "content": user_message})

        try:
            completion = self.client.chat.completions.create(
                model="llama3-8b-8192",
                messages=messages,
                temperature=0.7,
                max_tokens=500
            )
            return completion.choices[0].message.content
        except Exception as e:
            print(f"Chat Error: {e}")
            return "I'm having trouble connecting to my brain. Please try again in a moment."

    def _get_fallback_recommendations(self, risk_factors: Dict[str, float]) -> List[Dict[str, Any]]:
        # Fallback logic if API fails or key missing
        recs = []
        if risk_factors.get('breach_risk', 0) > 0.5:
            recs.append({"type": "critical", "title": "Breach Detected", "description": "Credentials found in leaks. Reset immediately."})
        recs.append({"type": "warning", "title": "Outdated Firmware", "description": "Router firmware check recommended."})
        return recs
