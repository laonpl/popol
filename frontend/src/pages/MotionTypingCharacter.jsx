const clamp = n => Math.max(0, Math.min(1, n));
const smooth = n => { const p = clamp(n); return p * p * (3 - 2 * p); };

// Hand silhouettes are traced in the original 1672 x 941 image space. A clean
// keyboard plate underneath means lifting a finger never leaves a second hand.
const LEFT = 'M737 624Q761 617 777 621Q800 620 812 639Q824 648 830 658Q833 666 825 669Q817 669 809 661L796 652L776 659L766 668Q786 666 800 668Q810 669 810 678Q807 687 792 691L765 692Z';
const RIGHT = 'M837 711Q833 698 840 686L863 661Q877 645 888 649Q896 650 902 656Q913 644 922 652L930 662Q941 660 946 670L952 684Q961 690 957 700Q954 706 946 702L939 693Q934 707 922 718Q909 734 889 741Q867 722 837 711Z';

export default function TypingCharacter({ time, cycle = 5 }) {
  // Short thinking pauses between phrases and while the application changes.
  const local = time % cycle;
  const active = smooth(local / (cycle * .09)) * (1 - smooth((local - cycle * .78) / (cycle * .14)));
  const burst = .62 + .38 * Math.sin(time * 2.3) ** 2;
  const leftPress = Math.sin(time * 2 * Math.PI * 3.1);
  const rightPress = Math.sin(time * 2 * Math.PI * 3.7 + 1.4);
  const hands = [
    { id: 'left', path: LEFT, x: 749, y: 641, press: leftPress, angle: -.8, fingers: [[807, 650, 17, 15], [797, 638, 16, 14]] },
    { id: 'right', path: RIGHT, x: 857, y: 719, press: rightPress, angle: .9, fingers: [[940, 685, 16, 17], [926, 669, 16, 16], [905, 657, 16, 12]] },
  ];
  return <g transform="scale(.8612440191 .8607863974)" data-typing-character="true">
    <image href="/motion/graduate-typing.png" width="1672" height="941" />
    <defs>
      <clipPath id="typing-clean-area"><path d="M729 612H837V700H754Z M824 641H968V746H830Z" /></clipPath>
      {hands.map(hand => <clipPath key={hand.id} id={`typing-${hand.id}`}><path d={hand.path} /></clipPath>)}
      {hands.flatMap(hand => hand.fingers.map(([x, y, rx, ry], i) => <clipPath key={`${hand.id}-${i}`} id={`finger-${hand.id}-${i}`}><ellipse cx={x} cy={y} rx={rx} ry={ry} /></clipPath>))}
    </defs>
    <image href="/motion/graduate-typing-clean.png" width="1672" height="941" clipPath="url(#typing-clean-area)" />
    {hands.map(hand => {
      const press = hand.press * active * burst;
      return <g key={hand.id} data-hand={hand.id} transform={`translate(${press * .65} ${-active * (1 - hand.press) * 1.9}) rotate(${press * hand.angle} ${hand.x} ${hand.y})`}>
        <image href="/motion/graduate-typing.png" width="1672" height="941" clipPath={`url(#typing-${hand.id})`} />
        <g clipPath={`url(#typing-${hand.id})`}>
          {hand.fingers.map(([x, y], i) => {
            const tap = Math.sin(time * Math.PI * 2 * (3.3 + i * .37) + i * 2.2) * active;
            return <g key={i} transform={`rotate(${tap * 2.2} ${x - 12} ${y + 8}) translate(0 ${tap * .7})`}>
              <image href="/motion/graduate-typing.png" width="1672" height="941" clipPath={`url(#finger-${hand.id}-${i})`} />
            </g>;
          })}
        </g>
      </g>;
    })}
  </g>;
}
