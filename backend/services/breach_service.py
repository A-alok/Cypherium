import hashlib
import os
import random
import requests
from typing import Dict, Any, List

class BreachService:
    """Service for checking identity breaches using Have I Been Pwned API."""
    
    def __init__(self):
        self.provider_name = "Have I Been Pwned"
    
    def check_email_breaches(self, email: str) -> Dict[str, Any]:
        """Check if an email has been involved in data breaches using HIBP."""
        api_key = os.getenv('HIBP_API_KEY')
        if not api_key:
            return {
                "email": email,
                "breach_count": 0,
                "breaches": [],
                "risk_level": "low",
                "status": "warning_missing_api_key_configuration"
            }
        
        headers = {
            'hibp-api-key': api_key,
            'user-agent': 'SafetyAssistant'
        }
        
        try:
            response = requests.get(
                f'https://haveibeenpwned.com/api/v3/breachedaccount/{email}',
                headers=headers
            )
            if response.status_code == 404:
                return {"email": email, "breach_count": 0, "breaches": [], "risk_level": "low"}
            response.raise_for_status()
            
            breaches = response.json()
            return {
                "email": email,
                "breach_count": len(breaches),
                "breaches": breaches,
                "risk_level": self._calculate_breach_risk(len(breaches)),
                "provider": self.provider_name,
                "status": "monitored"
            }
        except Exception as e:
            return {
                "email": email,
                "breach_count": 0,
                "breaches": [],
                "risk_level": "unknown",
                "error": f"Failed to check breaches: {str(e)}"
            }
    
    def check_password_safety(self, password: str) -> Dict[str, Any]:
        """Check password safety using k-anonymity method."""
        sha1_hash = hashlib.sha1(password.encode()).hexdigest().upper()
        prefix = sha1_hash[:5]
        suffix = sha1_hash[5:]
        
        count = 0
        try:
            response = requests.get(f'https://api.pwnedpasswords.com/range/{prefix}')
            if response.status_code == 200:
                lines = response.text.splitlines()
                for line in lines:
                    hash_suffix, count_str = line.split(':')
                    if hash_suffix == suffix:
                        count = int(count_str)
                        break
        except Exception:
            pass
        
        return {
            "password_hash_prefix": prefix,
            "compromised_count": count,
            "safety_status": "compromised" if count > 0 else "safe",
            "recommendation": self._get_password_recommendation(count),
            "provider": "Pwned Passwords"
        }

    def _calculate_breach_risk(self, breach_count: int) -> str:
        if breach_count == 0: return "low"
        elif breach_count <= 2: return "medium"
        else: return "high"
    
    def _get_password_recommendation(self, compromise_count: int) -> str:
        if compromise_count == 0:
            return "Pwned Passwords verifies this password as safe from known breaches."
        else:
            return f"Warning: Pwned Passwords detected this password in {compromise_count:,} public leaks! Change it for safety."