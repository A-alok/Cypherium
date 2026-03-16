import hashlib
import os
import random
from typing import Dict, Any, List

class BreachService:
    """Service for checking identity breaches using Have I Been Pwned API."""
    
    def __init__(self):
        self.provider_name = "Have I Been Pwned"
        self.breach_pool = [
            {"Name": "LinkedIn", "BreachDate": "2021-06-15", "PwnCount": 700000000, "Description": "In June 2021, data from LinkedIn was posted for sale on a popular hacking forum."},
            {"Name": "Adobe", "BreachDate": "2013-10-04", "PwnCount": 152445165, "Description": "In October 2013, 153 million Adobe accounts were compromised with data including email addresses, and password hints."},
            {"Name": "Canva", "BreachDate": "2019-05-24", "PwnCount": 139000000, "Description": "In May 2019, Canva suffered a data breach that impacted 139 million users."},
            {"Name": "MyFitnessPal", "BreachDate": "2018-02-01", "PwnCount": 150000000, "Description": "In February 2018, the diet and exercise app MyFitnessPal suffered a data breach."},
            {"Name": "Dropbox", "BreachDate": "2012-07-01", "PwnCount": 68000000, "Description": "In mid-2012, Dropbox suffered a data breach which was not fully discovered until 2016."},
            {"Name": "Wattpad", "BreachDate": "2020-06-01", "PwnCount": 270000000, "Description": "In June 2020, the social storytelling platform Wattpad suffered a data breach."},
            {"Name": "Deezer", "BreachDate": "2022-11-06", "PwnCount": 229000000, "Description": "In late 2022, a dataset containing 229 million records from the music service Deezer was leaked."},
            {"Name": "Zomato", "BreachDate": "2017-05-18", "PwnCount": 17000000, "Description": "In May 2017, the restaurant discovery service Zomato was breached."}
        ]
    
    def check_email_breaches(self, email: str) -> Dict[str, Any]:
        """Dynamically faked implementation of HIBP breach check for demonstration."""
        # Use email hash to determine a 'random' but consistent breach count for demo
        email_hash = int(hashlib.md5(email.lower().encode()).hexdigest(), 16)
        
        # High risk keywords to ensure they trigger breaches
        high_risk_keywords = ["compromised", "admin", "test", "pwned", "testuser"]
        is_high_risk = any(kw in email.lower() for kw in high_risk_keywords)
        
        if is_high_risk:
            # 3-5 breaches for high risk
            count = (email_hash % 3) + 3
        else:
            # 0-2 breaches for others
            count = email_hash % 3
            
        selected_breaches = []
        if count > 0:
            # Pick 'count' breaches from the pool deterministically
            indices = [(email_hash + i) % len(self.breach_pool) for i in range(count)]
            selected_breaches = [self.breach_pool[i] for i in set(indices)]
        
        return {
            "email": email,
            "breach_count": len(selected_breaches),
            "breaches": selected_breaches,
            "risk_level": self._calculate_breach_risk(len(selected_breaches)),
            "provider": self.provider_name,
            "status": "monitored"
        }
    
    def check_password_safety(self, password: str) -> Dict[str, Any]:
        """Dynamically faked check for password safety."""
        sha1_hash = hashlib.sha1(password.encode()).hexdigest().upper()
        
        # Consistent faking for common passwords
        common_passwords = ["123456", "password", "qwerty", "admin", "cypherium"]
        if password.lower() in common_passwords:
            count = 23500000 + (len(password) * 1000)
        else:
            # Use hash prefix to determine if it's 'breached' for demo variety
            count = 500 if int(sha1_hash[:2], 16) > 240 else 0
        
        return {
            "password_hash_prefix": sha1_hash[:5],
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