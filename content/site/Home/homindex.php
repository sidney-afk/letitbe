<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Strict//EN">
<html>
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=ISO-8859-1">

        <!-- Cascading Style Sheets -->
        <link rel="stylesheet" type="text/css" href="../Tech/JQuery/Diapo/diapostyle.css" />
        <link rel="stylesheet" type="text/css" href="../Tech/JQuery/Diapo/diapopage.css" />
        <link rel="stylesheet" type="text/css" href="../Tech/Style/MyStyle.css" />

	<script type="text/javascript" src="../Tech/JQuery/Diapo/js/jquery-1.6.1.min.js"></script>

	<script type="text/javascript" src="../Tech/JQuery/Diapo/js/jquery.jDiaporama.js"></script>


   <script language="JavaScript" type="text/javascript">
    function ChangeSrc(source)
    {
          document.getElementById("HomeCorps").src = source;
    }

  </script>

  </head>
  <body>
    <script>
      $(document).ready(function(){
	var myDiapo = $(".diaporama1").jDiaporama({
		delay:3,
		theme:"border",
		animationSpeed: 1500,
		useThumbs: false,
		constraintWidth: true,
		width:135,
		height:215,
		transition:"fade"
	  });
	});
    </script>
    <table class="Main">
      <tr>
        <td class="Left" style="background-color: silver;">
        <table>
          <tr>
            <td class="batbord">
              93797 visites
           </td>
          </tr>
          <tr>
            <td class="menupointeur2" 
			onclick="return event.returnValue = ChangeSrc('./home.html');" 
		>
              HOME
            </td>
          </tr>
          <tr>
            <td class="menupointeur" 
			onclick="return event.returnValue = ChangeSrc('./gsm.html');" 
		>
              Nous joindre
            </td>
          </tr>
          <tr>
            <td class="menupointeur" 
			onclick="return event.returnValue = ChangeSrc('../Actu/actu13.html');" 
		>
              Archives
            </td>
          </tr>
          <tr>
            <td class="menupointeur" 
			onclick="return event.returnValue = ChangeSrc('./lexique.html');" 
		>
              Lexique
            </td>
          </tr>
          <tr>
            <td class="menupointeur" 
			onclick="return event.returnValue = ChangeSrc('./genese.html');" 
		>
              Genèse
            </td>
          </tr>
          <tr height="215">
            <td>
 	<div class="diapo">
        <ul class="diaporama1">
            <li><img src="../Tech/Image/hp/hp (1).JPG" alt="Galapagos" /></li>
            <li><img src="../Tech/Image/hp/hp (2).JPG" alt="Gambier" /></li>
            <li><img src="../Tech/Image/hp/hp (3).JPG" alt="Eric" /></li>
            <li><img src="../Tech/Image/hp/hp (4).JPG" alt="Fakarava" /></li>
            <li><img src="../Tech/Image/hp/hp (5).JPG" alt="Tonga" /></li>
            <li><img src="../Tech/Image/hp/hp (6).JPG" alt="Cook" /></li>
            <li><img src="../Tech/Image/hp/hp (7).JPG" alt="Galapagos" /></li>
            <li><img src="../Tech/Image/hp/hp (8).JPG" alt="Faaite" /></li>
            <li><img src="../Tech/Image/hp/hp (9).JPG" alt="Tonga" /></li>
            <li><img src="../Tech/Image/hp/hp (10).JPG" alt="Gambier" /></li>
            <li><img src="../Tech/Image/hp/hp (11).JPG" alt="Cécile" /></li>
            <li><img src="../Tech/Image/hp/hp (12).JPG" alt="Moorea" /></li>
            <li><img src="../Tech/Image/hp/hp (13).JPG" alt="Tonga" /></li>
            <li><img src="../Tech/Image/hp/hp (14).JPG" alt="Cécile" /></li>
            <li><img src="../Tech/Image/hp/hp (15).JPG" alt="Bora Bora" /></li>
            <li><img src="../Tech/Image/hp/hp (16).JPG" alt="Eric" /></li>
            <li><img src="../Tech/Image/hp/hp (17).JPG" alt="Fidji" /></li>
            <li><img src="../Tech/Image/hp/hp (18).JPG" alt="Tahaa" /></li>
            <li><img src="../Tech/Image/hp/hp (19).JPG" alt="Eric&Cécile" /></li>
            <li><img src="../Tech/Image/hp/hp (20).JPG" alt="Gambier" /></li>
            <li><img src="../Tech/Image/hp/hp (21).JPG" alt="Moorea" /></li>
            <li><img src="../Tech/Image/hp/hp (22).JPG" alt="Eric&Cécile" /></li>
            <li><img src="../Tech/Image/hp/hp (23).JPG" alt="Sidney" /></li>
            <li><img src="../Tech/Image/hp/hp (24).JPG" alt="Gambier" /></li>
            <li><img src="../Tech/Image/hp/hp (25).JPG" alt="Kenya" /></li>
            <li><img src="../Tech/Image/hp/hp (26).JPG" alt="New Zealand" /></li>
            <li><img src="../Tech/Image/hp/hp (27).JPG" alt="Kenya" /></li>
            <li><img src="../Tech/Image/hp/hp (28).JPG" alt="Ua Pou" /></li>
            <li><img src="../Tech/Image/hp/hp (29).JPG" alt="Nuku Hiva" /></li>
            <li><img src="../Tech/Image/hp/hp (30).JPG" alt="Booby" /></li>
            <li><img src="../Tech/Image/hp/hp (31).JPG" alt="Manta" /></li>
            <li><img src="../Tech/Image/hp/hp (32).JPG" alt="Beveridge Reef" /></li>
            <li><img src="../Tech/Image/hp/hp (33).JPG" alt="Corail mou" /></li>
            <li><img src="../Tech/Image/hp/hp (34).JPG" alt="Cécile" /></li>
            <li><img src="../Tech/Image/hp/hp (35).JPG" alt="Tonga" /></li>
            <li><img src="../Tech/Image/hp/hp (36).JPG" alt="Rangiroa" /></li>
            <li><img src="../Tech/Image/hp/hp (37).JPG" alt="Rarotonga" /></li>
            <li><img src="../Tech/Image/hp/hp (38).JPG" alt="Sidney" /></li>
            <li><img src="../Tech/Image/hp/hp (39).JPG" alt="Niue" /></li>
            <li><img src="../Tech/Image/hp/hp (40).JPG" alt="Frazer Island" /></li>
        </ul>
 	</div>
            </td>
          </tr>
          <tr>
            <td>
		<a class="acc" href="../index.html" width="140" target="_top">Home</a>
            </td>
          </tr>
        </table>
	</td>
	<td class="corps">
          <iframe id="HomeCorps" src="./home.html" width=100% height=100% frameborder=0></iframe>
        </td>
        <td class="Left">
	  <div><img height="475" src="../Tech/Image/Left.jpg")"></img></div>
        </td>
      </tr>
    </table>
  </body>
</html>