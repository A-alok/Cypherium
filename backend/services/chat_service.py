import re
from typing import List, Dict, Any

class ChatbotService:
    def __init__(self):
        # Extremely basic intent matching since we don't have a real LLM connected
        self.intents = {
            "greeting": [r'\bhi\b', r'\bhello\b', r'\bhey\b'],
            "score": [r'score', r'risk', r'how safe'],
            "phishing": [r'phish', r'fake email', r'scam'],
            "password": [r'password', r'breach', r'leak', r'pwned'],
            "speed": [r'slow', r'fast', r'performance'],
            "help": [r'help', r'what can you do', r'support']
        }
        
    def _match_intent(self, message: str) -> str:
        msg_lower = message.lower()
        for intent, patterns in self.intents.items():
            for regex in patterns:
                if re.search(regex, msg_lower):
                    return intent
        return "unknown"

    def get_response(self, message: str, context: Dict[str, Any]) -> tuple[str, List[str]]:
        intent = self._match_intent(message)
        
        # Inject context (score, anomalies, incidents)
        risk_score = context.get('risk_score', 0)
        active_anomalies = context.get('active_anomalies', [])
        
        response = ""
        suggestions = []

        if intent == "greeting":
            response = f"Hello! I'm your Cypherium security coach. Your current risk score is {int(risk_score)}. How can I help you stay safe today?"
            suggestions = ["What does my score mean?", "Check for breaches", "I received a suspicious email"]
            
        elif intent == "score":
            if risk_score > 70:
                response = f"Your score is {int(risk_score)}, which is HIGH risk. You should review your dashboard recommendations immediately."
                suggestions = ["Show me my recommendations", "How do I secure my account?"]
            elif risk_score > 40:
                response = f"Your score is {int(risk_score)}, indicating MODERATE risk. There's room for improvement."
                suggestions = ["How to improve my score?", "Review scan history"]
            else:
                response = f"Your score is {int(risk_score)} (LOW risk). Great job keeping your accounts secure!"
                suggestions = ["Best practices for security", "Run a new scan"]

        elif intent == "password":
            response = "If you think your password was compromised, you should change it immediately and enable Two-Factor Authentication (2FA). Would you like me to start the 'Compromised Password' incident playbook for you?"
            suggestions = ["Yes, start playbook", "How to create a strong password?"]

        elif intent == "phishing":
            response = "Received a suspicious link or email? Don't click it! You can paste the URL or email content into the scanner tool on your dashboard, and I'll analyze it for you."
            suggestions = ["Take me to the scanner", "I already clicked it!"]

        elif intent == "help":
            response = "I can help you understand your security score, give advice on suspicious emails/links, guide you through security incidents, or explain security concepts."
            suggestions = ["Explain Two-Factor Auth", "Why am I moderate risk?"]

        else:
            if active_anomalies:
                response = f"I didn't quite catch that. But I do notice you have {len(active_anomalies)} active anomaly alert(s). We should probably look at those."
                suggestions = ["Show my anomalies"]
            else:
                response = "I'm a simple security assistant right now. You can ask me about your risk score, passwords, phishing, or what to do if you're hacked."
                suggestions = ["What's my risk score?", "I've been hacked"]

        return response, suggestions
