import { TimelineItem } from "@/types";

export function generateFCPXML(timeline: TimelineItem[], projectName: string = "Storyboard Project"): string {
  const frameRate = 24;
  const frameDuration = "100/2400s"; // Standard for 24fps in FCPXML
  
  // Header
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fcpxml>
<fcpxml version="1.9">
  <resources>
    <format id="r1" name="FFVideoFormat1080p24" frameDuration="${frameDuration}" width="1920" height="1080"/>
    <effect id="e1" name="Cross Dissolve" uid=".../Transitions.localized/Dissolves.localized/Cross Dissolve.localized/Cross Dissolve.moti"/>
`;

  // Resources (Images/Audio)
  // Since we have URLs (often blob or remote), mapping them to local files for FCPXML is tricky.
  // Realistically, FCPXML expects file:// paths. 
  // We will create placeholder resources.
  timeline.forEach((item, index) => {
      // Visual Resource
      xml += `    <asset id="asset_v_${index}" name="Visual ${index + 1}" uid="uid_v_${index}" src="file:///Users/User/Desktop/Assets/${item.id}_visual.png" start="0s" duration="${item.duration}s" hasVideo="1" format="r1" />\n`;
      // Audio Resource
      if (item.audioUrl) {
          xml += `    <asset id="asset_a_${index}" name="Audio ${index + 1}" uid="uid_a_${index}" src="file:///Users/User/Desktop/Assets/${item.id}_audio.mp3" start="0s" duration="${item.duration}s" hasAudio="1" />\n`;
      }
  });

  xml += `  </resources>
  <library>
    <event name="Gemini Generated Event">
      <project name="${projectName}">
        <sequence format="r1">
          <spine>
`;

  // Clips
  let offset = 0;
  timeline.forEach((item, index) => {
    const durationFrames = item.duration * frameRate;
    const durationStr = `${durationFrames * 100}/2400s`; // FCPXML time format
    const offsetStr = `${offset * 100}/2400s`;
    
    const transition = item.transition === 'fade' || item.transition === 'dissolve' 
        ? `<transition name="Cross Dissolve" offset="0s" duration="1s" effect="e1"/>` 
        : '';

    xml += `            <asset-clip name="${item.text.substring(0, 30)}..." ref="asset_v_${index}" offset="${offsetStr}" duration="${durationStr}" start="0s" format="r1">
              <note>${item.notes || ''}</note>
              ${item.audioUrl ? `<asset-clip name="Audio ${index+1}" lane="-1" offset="0s" ref="asset_a_${index}" duration="${durationStr}" start="0s" role="dialogue" />` : ''}
            </asset-clip>
            ${transition}
`;
    offset += durationFrames;
  });

  xml += `          </spine>
        </sequence>
      </project>
    </event>
  </library>
</fcpxml>`;

  return xml;
}



