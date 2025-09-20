
import type { SVGProps } from "react";

export function GuardianTrackLogo(props: SVGProps<SVGSVGElement>) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 100 100"
        width="100"
        height="100"
        {...props}
      >
        <defs>
            <linearGradient id="shieldGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#dbeafe" />
                <stop offset="100%" stopColor="#bfdbfe" />
            </linearGradient>
            <pattern id="honeycomb" patternUnits="userSpaceOnUse" width="10" height="17.32" x="0" y="0">
                <g>
                    <path d="M5 0 l2.5 4.33 l-2.5 4.33 l-5 0 l-2.5 -4.33 l2.5 -4.33z" fill="#cae8ff" stroke="#b0dfff" strokeWidth="0.5"/>
                    <path d="M15 0 l2.5 4.33 l-2.5 4.33 l-5 0 l-2.5 -4.33 l2.5 -4.33z" fill="#cae8ff" stroke="#b0dfff" strokeWidth="0.5"/>
                    <path d="M0 8.66 l2.5 4.33 l-2.5 4.33 l-5 0 l-2.5 -4.33 l2.5 -4.33z" fill="#cae8ff" stroke="#b0dfff" strokeWidth="0.5"/>
                    <path d="M10 8.66 l2.5 4.33 l-2.5 4.33 l-5 0 l-2.5 -4.33 l2.5 -4.33z" fill="#cae8ff" stroke="#b0dfff" strokeWidth="0.5"/>
                </g>
            </pattern>
        </defs>
        
        <g transform="translate(0 -5)">
            <path
              d="M17.5,15.2 C17.5,15.2 20.3,12 50,12 C79.7,12 82.5,15.2 82.5,15.2 L82.5,50 C82.5,50 82.5,85 50,95 C17.5,85 17.5,50 17.5,50 L17.5,15.2 Z"
              fill="url(#shieldGradient)"
              stroke="#1e40af"
              strokeWidth="3"
            />
             <rect
              x="17.5"
              y="12"
              width="65"
              height="83"
              fill="url(#honeycomb)"
              opacity="0.3"
              mask="url(#shieldMask)"
            />
            
            <path
              d="M17,45 C5,55 0,60 0,60 L2,35 C2,35 15,25 17,45 Z"
              fill="white"
              stroke="#e0e7ff"
              strokeWidth="2"
            />
            <path
              d="M10,48 C-5,55 0,65 0,65 L2,40 C2,40 10,35 10,48 Z"
              fill="white"
              stroke="#e0e7ff"
              strokeWidth="1.5"
              transform="translate(4, -2)"
            />
        
            <path
              d="M83,45 C95,55 100,60 100,60 L98,35 C98,35 85,25 83,45 Z"
              fill="white"
              stroke="#e0e7ff"
              strokeWidth="2"
            />
             <path
              d="M90,48 C105,55 100,65 100,65 L98,40 C98,40 90,35 90,48 Z"
              fill="white"
              stroke="#e0e7ff"
              strokeWidth="1.5"
              transform="translate(-4, -2)"
            />
    
            <g transform="translate(2, 5)">
                <rect x="30" y="30" width="36" height="25" rx="5" fill="#facc15" stroke="#1e40af" strokeWidth="2.5" />
                <rect x="32" y="32" width="32" height="12" rx="3" fill="#1e3a8a" />
                
                <rect x="36" y="58" width="6" height="3" fill="#1e3a8a" />
                <rect x="54" y="58" width="6" height="3" fill="#1e3a8a" />
                
                <circle cx="39" cy="62" r="3.5" fill="white" stroke="#1e3a8a" strokeWidth="1.5" />
                <circle cx="57" cy="62" r="3.5" fill="white" stroke="#1e3a8a" strokeWidth="1.5" />
        
                <rect x="42" y="50" width="12" height="2" rx="1" fill="#1e3a8a" />
                <rect x="42" y="55" width="12" height="2" rx="1" fill="#1e3a8a" />
            </g>
        </g>
         <mask id="shieldMask">
              <path
              d="M17.5,15.2 C17.5,15.2 20.3,12 50,12 C79.7,12 82.5,15.2 82.5,15.2 L82.5,50 C82.5,50 82.5,85 50,95 C17.5,85 17.5,50 17.5,50 L17.5,15.2 Z"
              fill="white"
            />
        </mask>
      </svg>
    )
}
