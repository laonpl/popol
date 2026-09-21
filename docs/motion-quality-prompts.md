# Motion 캐릭터 수정 프롬프트

두 이미지 모두 **built-in image_gen**으로 만들고 생성 결과를 프로젝트로 복사했다. CLI/API fallback은 사용하지 않았다. 요청 해상도는 4K였으나 실제 생성 크기는 1672×941이다.

## frontend/public/motion/graduate-typing.png

Edit target: `frontend/public/motion/graduate-rear.png`.

Use case: precise-object-edit. Edit target: the supplied rear-view 3D graduate at desktop image. For a premium animated film. Keep EXACT camera, 16:9 composition, monitor quadrilateral and bezel position, keyboard position, head, hair, torso, chair, mug, lighting and pale lavender desk. Change ONLY his right forearm and right hand: move right hand off the mouse onto the RIGHT HALF OF THE KEYBOARD, so BOTH hands are naturally poised typing with gently curved separated fingers, wrists low, anatomically correct. Left hand stays on left keyboard. Mouse remains visible on desk unused. Maintain detailed ivory shirt folds and peach skin. Highest resolution possible, ideally 3840x2160, refined sharp render with no artificial blur, no letters or text, no new objects. Preserve blank monitor. This is a subtle pose correction, no restyling or recomposition.

## frontend/public/motion/graduate-typing-clean.png

Edit target: `frontend/public/motion/graduate-typing.png`.

Use case: precise-object-edit. Edit target supplied typing character image. Create the background clean plate for animation compositing. Remove ONLY the two peach-colored hands (including fingers and visible skin wrists) resting on keyboard. Reconstruct the keyboard keys and desk behind those hands. Keep BOTH ivory shirt sleeves and their cuffs EXACTLY as-is, with empty cuff openings where hands were. Keep entire rest of image absolutely identical: head, torso, arms, sleeves, monitor, mug, keyboard position, mouse, lighting, camera framing, proportions, resolution. Do not change arm pose. No new objects. No text. The hands will be composited back from the original image as moving layers. Highest quality crisp matching rendering.
